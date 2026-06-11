import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { validateQuestionSet } from '$lib/validateQuestionSet';
import { generateQuestionSet, buildUserContent, sanitizeQuestion, MODEL } from '$lib/ai/questionSet';
import { hasAiAccess, isAiElevated, monthlyCreditsFor } from '$lib/ai/access';

// ── Caps & credit costs (constants — not DB/UI editable) ──
const DAILY_CAP = 50;            // sitewide credits per day (platform overbilling backstop)
const MAX_TOKENS = 16000;        // output ceiling (up to ~100 questions)
const MAX_INPUT_CHARS = 60000;        // ~15K tokens (normal document)
const MAX_INPUT_CHARS_LARGE = 240000; // ~60K tokens (large document)
const PDF_MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAX_BYTES_LARGE = 20 * 1024 * 1024;
const MAX_PER_TIER = 25;

// Credit cost per request.
const CREDITS_PROMPT = 1, CREDITS_DOC = 5, CREDITS_LARGE_DOC = 10;

const ALLOWED_TYPES = ['multi_select', 'multiple_choice', 'true_false', 'typed', 'fill_gap'];
const TIERS = ['easy', 'medium', 'hard', 'elite'];

// Sonnet 4.6 pricing per 1M tokens.
const PRICE_IN = 3, PRICE_OUT = 15;

export async function POST({ request, platform }) {
  const env = platform?.env ?? {};
  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ANTHROPIC_API_KEY || !SERVICE_ROLE) {
    return json({ error: 'AI generator is not configured on the server.' }, { status: 500 });
  }

  // ── Auth: verify the Supabase JWT ──
  const authz = request.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return json({ error: 'Not authenticated.' }, { status: 401 });

  const anon = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = userData.user.id;

  const admin = createClient(PUBLIC_SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── Access gate (server-side; the UI gate is cosmetic) ──
  const { data: profile } = await admin.from('profiles').select('tier, ai_monthly_credits').eq('id', userId).single();
  if (!hasAiAccess(profile?.tier)) return json({ error: 'AI generation is not available on your account.' }, { status: 403 });
  const monthlyCap = monthlyCreditsFor(profile.tier, profile.ai_monthly_credits);
  const elevated = isAiElevated(profile.tier);

  // ── Body ──
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request body.' }, { status: 400 });
  const mode = body.mode === 'reprompt' ? 'reprompt' : 'generate';
  const largeDocument = !!body.largeDocument;

  // "Get from context" — let the model decide types/mix and/or per-tier counts.
  const autoTypes = !!body.autoTypes;
  const autoCounts = !!body.autoCounts;

  const types = Array.isArray(body.types) ? body.types.filter((t) => ALLOWED_TYPES.includes(t)) : [];
  if (!autoTypes && !types.length) return json({ error: 'Select at least one question type.' }, { status: 400 });

  // Weights — default even if missing; normalize defensively (UI keeps them at 100).
  const weights = {};
  for (const t of types) {
    const w = Math.round(Number(body.weights?.[t]));
    weights[t] = Number.isFinite(w) && w >= 0 ? w : 0;
  }
  if (!autoTypes && types.reduce((s, t) => s + weights[t], 0) === 0) {
    const even = Math.round(100 / types.length);
    for (const t of types) weights[t] = even;
  }

  // Counts — clamp 0..MAX_PER_TIER.
  const counts = {};
  let total = 0;
  for (const tier of TIERS) {
    let n = Math.round(Number(body.counts?.[tier]));
    if (!Number.isFinite(n) || n < 0) n = 0;
    if (n > MAX_PER_TIER) n = MAX_PER_TIER;
    counts[tier] = n;
    total += n;
  }
  if (!autoCounts && total === 0) return json({ error: 'Set at least one tier above zero.' }, { status: 400 });

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  const text = typeof body.text === 'string' ? body.text : '';
  const pdfBase64 = typeof body.pdfBase64 === 'string' && body.pdfBase64 ? body.pdfBase64 : null;

  const maxChars = largeDocument ? MAX_INPUT_CHARS_LARGE : MAX_INPUT_CHARS;
  const maxPdf = largeDocument ? PDF_MAX_BYTES_LARGE : PDF_MAX_BYTES;
  if (prompt.length + text.length > maxChars) {
    return json({ error: `Input is too large — trim it${largeDocument ? '' : ', or toggle "Large document"'}.` }, { status: 413 });
  }
  if (pdfBase64 && pdfBase64.length > maxPdf * 1.37) {
    return json({ error: `PDF is too large (max ~${largeDocument ? 20 : 5} MB).` }, { status: 413 });
  }

  // ── Reprompt: load the existing staged set (verify ownership) ──
  let existingSet = null, setId = null;
  if (mode === 'reprompt') {
    setId = body.setId;
    if (!setId) return json({ error: 'Missing set id.' }, { status: 400 });
    const { data: row } = await admin
      .from('user_question_sets').select('id, data, user_id').eq('id', setId).single();
    if (!row || row.user_id !== userId) return json({ error: 'Set not found.' }, { status: 404 });
    existingSet = row.data;
  } else if (!prompt.trim() && !text.trim() && !pdfBase64) {
    return json({ error: 'Provide a prompt or a file to generate from.' }, { status: 400 });
  }

  // ── Credit check (atomic) — per-user monthly allotment + platform daily cap ──
  const hasDocument = mode === 'generate' && (!!pdfBase64 || text.trim().length > 0);
  const amount = hasDocument ? (largeDocument ? CREDITS_LARGE_DOC : CREDITS_DOC) : CREDITS_PROMPT;
  const { data: consume, error: capErr } = await admin.rpc('consume_ai_credits', {
    p_user: userId, p_amount: amount, p_daily_cap: DAILY_CAP, p_monthly_cap: monthlyCap
  });
  if (capErr) return json({ error: 'Usage check failed.' }, { status: 500 });
  if (!consume?.ok) {
    const u = { monthly: { used: consume?.monthly_used ?? 0, cap: monthlyCap }, ...(elevated ? { daily: { used: consume?.daily_used ?? 0, cap: DAILY_CAP } } : {}) };
    const msg = consume?.reason === 'monthly'
      ? `Monthly credit limit reached (${monthlyCap}). It resets next month.`
      : `Daily platform limit reached (${DAILY_CAP}). Try again tomorrow.`;
    return json({ error: msg, ...u }, { status: 429 });
  }
  const usage = { monthly: { used: consume.monthly_used, cap: monthlyCap }, ...(elevated ? { daily: { used: consume.daily_used, cap: DAILY_CAP } } : {}) };

  // ── Generate ──
  let result;
  try {
    const content = buildUserContent({ mode, prompt, text, pdfBase64, types, weights, counts, autoTypes, autoCounts, existingSet, comment: body.comment });
    result = await generateQuestionSet({ apiKey: ANTHROPIC_API_KEY, maxTokens: MAX_TOKENS, content });
  } catch (e) {
    return json({ error: 'Generation failed: ' + (e?.message || 'unknown error') }, { status: 502 });
  }

  const out = result.data || {};
  const note = typeof out.note === 'string' && out.note.trim() ? out.note.trim() : null;
  const data = { name: out.name || 'Untitled set', description: out.description || null, version: '2.0', tiers: out.tiers || {} };

  const inTok = result.usage?.input_tokens ?? null;
  const outTok = result.usage?.output_tokens ?? null;
  const estCost = inTok != null && outTok != null ? (inTok * PRICE_IN + outTok * PRICE_OUT) / 1e6 : null;

  // Validation backstop — prune individual questions that fail rather than
  // rejecting the whole set, so one malformed question doesn't waste the run.
  // (Ignore "coming soon / will be skipped" warnings.)
  if (!data.tiers || typeof data.tiers !== 'object') data.tiers = {};
  let pruned = 0;
  for (const tier of TIERS) {
    const arr = Array.isArray(data.tiers[tier]) ? data.tiers[tier] : [];
    data.tiers[tier] = arr.map(sanitizeQuestion).filter((q) => {
      const qIssues = validateQuestionSet({ name: 'x', tiers: { [tier]: [q] } })
        .filter((i) => !/not yet supported by the renderer/.test(i));
      if (qIssues.length) { pruned++; return false; }
      return true;
    });
  }
  const questionCount = TIERS.reduce((s, t) => s + (data.tiers[t]?.length || 0), 0);

  let finalNote = note;
  if (pruned > 0) {
    const pn = `${pruned} question${pruned === 1 ? '' : 's'} were dropped for not matching the required format.`;
    finalNote = finalNote ? `${finalNote} ${pn}` : pn;
  }

  // Nothing usable came back.
  if (questionCount === 0) {
    await admin.from('ai_generations').insert({ user_id: userId, mode, model: MODEL, input_tokens: inTok, output_tokens: outTok, est_cost: estCost, set_id: setId ?? null });
    return json({ ok: false, issues: ['No valid questions could be generated — try again or adjust your input.'], note: finalNote, ...usage }, { status: 200 });
  }

  // ── Persist (staged) ──
  let savedRow = null;
  if (mode === 'reprompt') {
    const { data: upd } = await admin.from('user_question_sets')
      .update({ name: data.name, description: data.description, data, question_count: questionCount, ai_note: finalNote, updated_at: new Date().toISOString() })
      .eq('id', setId).eq('user_id', userId).select('*').single();
    savedRow = upd;
  } else {
    const { data: ins } = await admin.from('user_question_sets')
      .insert({ user_id: userId, name: data.name, description: data.description, data, question_count: questionCount, is_public: false, staged: true, ai_note: finalNote })
      .select('*').single();
    savedRow = ins;
  }

  // ── Usage log ──
  await admin.from('ai_generations').insert({
    user_id: userId, mode, model: MODEL, input_tokens: inTok, output_tokens: outTok, est_cost: estCost, set_id: savedRow?.id ?? setId ?? null
  });

  return json({ ok: true, set: savedRow, note: finalNote, ...usage }, { status: 200 });
}

// Lightweight usage read for the UI: today's used credits + the daily cap.
export async function GET({ request, platform }) {
  const env = platform?.env ?? {};
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_ROLE) return json({ error: 'Not configured.' }, { status: 500 });

  const authz = request.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return json({ error: 'Not authenticated.' }, { status: 401 });

  const anon = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const admin = createClient(PUBLIC_SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('tier, ai_monthly_credits').eq('id', userData.user.id).single();
  if (!hasAiAccess(profile?.tier)) return json({ error: 'Not available.' }, { status: 403 });
  const monthlyCap = monthlyCreditsFor(profile.tier, profile.ai_monthly_credits);
  const elevated = isAiElevated(profile.tier);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const { data: mRow } = await admin.from('ai_usage_monthly').select('credits').eq('user_id', userData.user.id).eq('month', monthStart).maybeSingle();

  const out = { monthly: { used: mRow?.credits ?? 0, cap: monthlyCap } };

  // Platform limit + token totals are visible to elevated tiers only.
  if (elevated) {
    const { data: dRow } = await admin.from('ai_usage_daily').select('count').eq('day', today).maybeSingle();
    const { data: gens } = await admin.from('ai_generations').select('input_tokens, output_tokens').eq('user_id', userData.user.id);
    let inTok = 0, outTok = 0;
    for (const g of gens || []) { inTok += g.input_tokens || 0; outTok += g.output_tokens || 0; }
    out.daily = { used: dRow?.count ?? 0, cap: DAILY_CAP };
    out.account = { input: inTok, output: outTok, total: inTok + outTok, generations: (gens || []).length };
  }

  return json(out);
}
