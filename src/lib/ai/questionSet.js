/**
 * AI question-set generation — schema, prompt, and the Claude call.
 * Server-only (uses the Anthropic SDK + API key). Output is validated against the
 * v2 schema by validateQuestionSet before anything is persisted.
 */
// Called via raw fetch (not the Anthropic SDK) so the Cloudflare Workers bundle
// has no Node dependencies (the SDK imports node:fs/promises, which Workers lack).
export const MODEL = 'claude-sonnet-4-6';

const TYPE_ENUM = ['multi_select', 'multiple_choice', 'true_false', 'typed', 'fill_gap'];

// Loose per-question schema — answers can be option indices (int) or accepted
// strings depending on type. validateQuestionSet enforces the per-type specifics.
const questionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: TYPE_ENUM },
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    answers: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'integer' }] } },
    explanation: { type: 'string' },
    template: { type: 'string' },
    required_count: { type: 'integer' },
    tolerance: { type: 'number' }
  },
  // Only `type` is hard-required — fill_gap uses `template` instead of `question`.
  required: ['type']
};

export const questionSetSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    note: { type: 'string' },
    tiers: {
      type: 'object',
      additionalProperties: false,
      properties: {
        easy: { type: 'array', items: questionSchema },
        medium: { type: 'array', items: questionSchema },
        hard: { type: 'array', items: questionSchema },
        elite: { type: 'array', items: questionSchema }
      },
      required: ['easy', 'medium', 'hard', 'elite']
    }
  },
  required: ['name', 'tiers']
};

const SYSTEM_PROMPT = `You generate quiz question sets for McChimp in a strict JSON schema. Output ONLY the raw JSON object — no markdown, no code fences, no commentary before or after.

SHAPE
{ "name", "description", "note", "tiers": { "easy":[], "medium":[], "hard":[], "elite":[] } }
- name: a short, specific title for the set.
- description: one sentence.
- note: leave empty unless you generated fewer questions than requested (see GROUNDING) — then briefly explain why.

QUESTION TYPES (use only the types requested by the user; respect the requested percentage mix as closely as the counts allow)
- multi_select: "options" (array of DISTINCT choices — never repeat an option) + "answers" (array of the correct option INDICES, no duplicate indices). One or more correct.
- multiple_choice: "options" (distinct) + "answers" with EXACTLY ONE index.
- true_false: omit "options"; "answers" is [0] for True or [1] for False.
- typed: "answers" is the pool of accepted answers. Matching is case-insensitive and trimmed, so do NOT add entries that differ only in capitalization or spacing. "required_count" = how many DISTINCT answers the user must type: use 1 for a single-answer question (you MAY still list a few interchangeable spellings/synonyms in the pool — only one of them needs to be typed). Use a number greater than 1 ONLY when the question genuinely asks for several different items (e.g. "Name three ..."), and then the pool must contain at least that many genuinely different answers. ALWAYS set "required_count" explicitly. "tolerance" (optional, numeric answers only) allows a +/- margin.
- fill_gap: "template" containing one or more "___" placeholders; "answers" is an array of strings, one per gap, in order. The number of "___" placeholders MUST exactly equal the number of entries in "answers". "question" is optional here.
Every question: add a concise "explanation". Give each a stable "id".

DIFFICULTY
easy = basic recall; medium = applied understanding; hard = detailed/nuanced; elite = expert-level or obscure. Calibrate per tier.

GROUNDING (critical)
Base every question strictly on the provided topic/material. Do NOT invent facts, names, dates, or statistics. If the material cannot support the requested number of questions for a tier, generate FEWER rather than fabricating, and explain the shortfall in "note". Accuracy over quantity, always.

ADAPTING SOURCE MATERIAL
Keep everything sized for a compact quiz UI: question text ideally under ~200 characters; each option a short phrase (ideally under ~80 characters); aim for 3–6 options. If a pre-written question or its options from an uploaded document run longer than this, rewrite them concisely while preserving meaning and the correct answer.
- "Combination" multiple choice (a numbered list of statements with answer options like "a) 1 and 3", "b) 2 and 4"): KEEP this format when it is short enough to fit — roughly 4 or fewer statements, each a brief phrase. If it is longer than that, convert it to a multi_select instead: use the individual statements directly as the options and ask the user to select the true ones (e.g. question "Select all statements that are true.", options = [statement 1, statement 2, ...], answers = indices of the true statements), and do not reproduce the "a) 1 and 3" meta-options.`;

/**
 * Repair common model mistakes before validation, so a fixable question isn't
 * dropped. Returns a new question object.
 * - typed: dedupe accepted answers case-insensitively; default required_count to
 *   1 (single answer) and clamp it to the number of DISTINCT answers. This stops
 *   "give every spelling" traps and the "answer the same twice" exploit.
 * - multi_select/multiple_choice: keep only unique, in-range integer answer
 *   indices; multiple_choice keeps exactly one.
 */
export function sanitizeQuestion(q) {
  if (!q || typeof q !== 'object') return q;
  const type = q.type || 'multi_select';
  const out = { ...q };

  if (type === 'typed') {
    const seen = new Set();
    const deduped = [];
    for (const a of Array.isArray(out.answers) ? out.answers : []) {
      const s = (typeof a === 'string' ? a : String(a)).trim();
      const key = s.toLowerCase();
      if (!s || seen.has(key)) continue;
      seen.add(key);
      deduped.push(s);
    }
    out.answers = deduped;
    let rc = out.required_count;
    if (typeof rc !== 'number' || !Number.isFinite(rc) || rc < 1) rc = 1;
    if (rc > deduped.length) rc = deduped.length || 1;
    out.required_count = rc;
  } else if (type === 'multi_select' || type === 'multiple_choice') {
    const n = Array.isArray(out.options) ? out.options.length : 0;
    const seen = new Set();
    const uniq = [];
    for (const ai of Array.isArray(out.answers) ? out.answers : []) {
      if (Number.isInteger(ai) && ai >= 0 && ai < n && !seen.has(ai)) {
        seen.add(ai);
        uniq.push(ai);
      }
    }
    out.answers = type === 'multiple_choice' ? uniq.slice(0, 1) : uniq;
  }

  return out;
}

/** Build the user-turn content blocks for a generation or reprompt request. */
export function buildUserContent({ mode, prompt, text, pdfBase64, types, weights, counts, autoTypes, autoCounts, existingSet, comment }) {
  const blocks = [];
  if (pdfBase64) {
    blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } });
  }

  const specLines = [];
  if (autoTypes) {
    specLines.push('Question types: choose the most suitable types and overall mix yourself, based on the material (use any of the supported types where they fit best).');
  } else {
    specLines.push(`Question types to use (only these): ${types.join(', ')}.`);
    specLines.push(`Approximate mix across all questions: ${types.map((t) => `${t} ${weights[t]}%`).join(', ')}.`);
  }
  if (autoCounts) {
    specLines.push('Number of questions: decide a sensible amount for each difficulty tier (easy/medium/hard/elite) based on how much the material genuinely supports. Keep the total reasonable unless the material clearly warrants more.');
  } else {
    specLines.push(`Target questions per tier — easy: ${counts.easy}, medium: ${counts.medium}, hard: ${counts.hard}, elite: ${counts.elite}.`);
  }
  const spec = specLines.join('\n');

  if (mode === 'reprompt' && existingSet) {
    blocks.push({
      type: 'text',
      text:
`Revise the existing question set below according to the adjustment request. Keep what works; change only what the request implies. Output the full revised set.

ADJUSTMENT REQUEST:
${comment?.trim() || '(no specific comment — improve quality and correctness)'}

CURRENT SET (JSON):
${JSON.stringify(existingSet)}

CONSTRAINTS:
${spec}`
    });
  } else {
    const src = [];
    if (prompt?.trim()) src.push(`TOPIC / PROMPT:\n${prompt.trim()}`);
    if (text?.trim()) src.push(`SOURCE MATERIAL:\n${text.trim()}`);
    blocks.push({
      type: 'text',
      text:
`Create a question set from the material below.

${src.join('\n\n') || '(see the attached document)'}

SPECIFICATION:
${spec}`
    });
  }

  return blocks;
}

// Parse the model's reply into an object — tolerant of stray code fences or
// surrounding text, since we don't use schema-enforced output.
function parseJsonObject(text) {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const first = s.indexOf('{'), last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch { /* fall through */ }
  }
  return null;
}

/**
 * Call Claude via the Messages API (streamed SSE, aggregated server-side) and
 * return { data, usage }. The exact JSON shape is specified in the system prompt;
 * validateQuestionSet is the backstop. Throws on API/parse failure.
 */
export async function generateQuestionSet({ apiKey, maxTokens, content }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  // Parse the SSE stream: accumulate text deltas + token usage.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '';
  const usage = { input_tokens: null, output_tokens: null };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        text += evt.delta.text;
      } else if (evt.type === 'message_start' && evt.message?.usage) {
        usage.input_tokens = evt.message.usage.input_tokens ?? usage.input_tokens;
      } else if (evt.type === 'message_delta' && evt.usage) {
        usage.output_tokens = evt.usage.output_tokens ?? usage.output_tokens;
      } else if (evt.type === 'error') {
        throw new Error(`Anthropic stream error: ${evt.error?.message || 'unknown'}`);
      }
    }
  }

  const data = parseJsonObject(text);
  if (!data) throw new Error('Model returned malformed JSON.');
  return { data, usage };
}
