<!-- src/routes/mma/+page.svelte -->
<script>
  import { onMount }  from 'svelte';
  import { get }      from 'svelte/store';
  import { page }     from '$app/stores';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import {
    loadAllSaves, loadSaveById,
    createSave, updateSave, deleteSave,
    loadPastCareers, archiveCareer,
    getUserLimits,
  }                   from '$lib/saves.js';
  import { fetchIndex, fetchSet } from '$lib/questions.js';
  import { logAnswer, difficultyToQScore } from '$lib/progress.js';

  import { state as gs }    from '$lib/mma/state.svelte.js';
  import {
    initState, initSparringState,
    buildLegacyStats, calcLegacyTitle, deriveRetireType,
  } from '$lib/mma/career.js';
  import { exportSave, loadSave } from '$lib/mma/saves.js';

  import MenuScreen         from '$lib/mma/screens/MenuScreen.svelte';
  import NamingScreen       from '$lib/mma/screens/NamingScreen.svelte';
  import PrefightScreen     from '$lib/mma/screens/PrefightScreen.svelte';
  import QuestionScreen     from '$lib/mma/screens/QuestionScreen.svelte';
  import ResultScreen       from '$lib/mma/screens/ResultScreen.svelte';
  import CareerEndScreen    from '$lib/mma/screens/CareerEndScreen.svelte';
  import EndScreen          from '$lib/mma/screens/EndScreen.svelte';
  import CareerPanel        from '$lib/mma/screens/CareerPanel.svelte';
  import BoutHistory        from '$lib/mma/screens/BoutHistory.svelte';
  import SavedCareersScreen from '$lib/mma/screens/SavedCareersScreen.svelte';
  import PastCareersScreen  from '$lib/mma/screens/PastCareersScreen.svelte';

  import { gf, classifyFighter }          from '$lib/mma/fighters.js';
  import {
    CHAMP_SLOT, RANKED_START,
    DIFF_LABELS, DIFF_COLORS, DIFF_BG,
  }                      from '$lib/mma/constants.js';
  import { getPhaseDef, getPlayerSlot, calloutSuccessPct, divisionPants, divisionBeltColor, divisionBeltType, CHAMP_PANTS, gloveColorFor } from '$lib/mma/career.js';
  import { divisionSlotToOpponent }  from '$lib/mma/fighters.js';
  import { surnameLookOverride }      from '$lib/mma/names.js';
  import { COUNTRY_BY_NAME }         from '$lib/mma/countries.js';
  import { REGIONS }                 from '$lib/mma/regions.js';
  import { nationalityFit }          from '$lib/avatar/nationalityFits.js';
  import { ethnicAvatar }            from '$lib/avatar/ethnicLooks.js';
  import FighterAvatar               from '$lib/avatar/FighterAvatar.svelte';

  const BLACK = '#181820';

  // Best-guess ethnicity for roster fighters (no stored ethnicity): the dominant
  // ethnic group of their country's region.
  function ethForNationality(name) {
    const dist = REGIONS[COUNTRY_BY_NAME[name]?.regionId]?.ethnicDistribution;
    if (!dist) return 'vintage';
    let best = 'vintage', bw = -1;
    for (const [k, w] of Object.entries(dist)) { if (k !== '*' && w > bw) { bw = w; best = k; } }
    return best;
  }

  // Championship bout: player challenging the champ, or champion defending.
  const titleFight = $derived((() => {
    const opp = gs.currentOpponent, cs = gs.career;
    if (!opp || !cs) return false;
    return opp.divisionSlot === CHAMP_SLOT || getPlayerSlot(cs) === CHAMP_SLOT;
  })());

  // Opponent avatar: ethnicity-based look + division pants + nationality/champion colours.
  const oppAvatar = $derived((() => {
    const opp = gs.currentOpponent;
    if (!opp) return null;
    // Use the stored appearance snapshot; older saves fall back to deriving it.
    const look = opp.look
      || ethnicAvatar(surnameLookOverride(opp.name) || opp.ethnicity || ethForNationality(opp.nationality), opp.fid || opp.name || 'x');
    const iso  = COUNTRY_BY_NAME[opp.nationality]?.iso || '';
    const playerMain = (gs.career?.avatar?.shortsBase || '').toLowerCase();
    const oppIsChamp = opp.divisionSlot === CHAMP_SLOT;
    let main, trim;
    if (oppIsChamp && playerMain !== BLACK) {
      main = CHAMP_PANTS.main; trim = CHAMP_PANTS.trim;   // champion: black/gold
    } else {
      let fit = nationalityFit(iso, 0);
      const collides = fit.main.toLowerCase() === (oppIsChamp ? BLACK : playerMain);
      if (collides) fit = nationalityFit(iso, 1);
      main = fit.main; trim = fit.trim;
    }
    return { ...look, shortsBase: main, shortsTrim: trim };
  })());
  const oppPants = $derived(gs.career ? divisionPants(gs.career) : 'gfl');
  // Opponent wears the division belt (correct design) when they're the champion.
  const oppIsChampion = $derived(gs.currentOpponent?.divisionSlot === CHAMP_SLOT && !!gs.career);
  const oppBeltType = $derived(oppIsChampion ? divisionBeltType(gs.career) : null);
  const oppBelt     = $derived(oppIsChampion ? divisionBeltColor(gs.career) : null);
  // Gloves: gold in title bouts, else red (higher rank) / blue (lower rank).
  const oppGlove = $derived((() => {
    const opp = gs.currentOpponent, cs = gs.career;
    if (!opp || !cs) return null;
    return gloveColorFor(opp.divisionSlot, getPlayerSlot(cs), titleFight, false);
  })());

  // ── Sidebar: ranking rows ─────────────────────────────
  const rankingRows = $derived((() => {
    const cs = gs.career;
    if (!cs?.division || gs.sparring) return [];
    const { slots, playerSlot } = cs.division;
    const rows = [];
    for (let i = slots.length - 1; i >= 0; i--) {
      const fid      = slots[i];
      const isPlayer = fid === 'player' || i === playerSlot;
      if (isPlayer && i !== playerSlot) continue; // stale 'player' string left in slots after division change
      const totalLosses = (gs.losses || 0) + (gs.finishes || 0);
      const f = isPlayer
        ? { name: cs.fighterName, record: `${gs.wins}-${totalLosses}`, wins: gs.wins, losses: totalLosses, draws: gs.draws || 0, isPlayer: true, flag: cs.playerFlag || '' }
        : gf(fid);
      if (!f) continue;
      const rankNum = i === CHAMP_SLOT ? 'C' : i < RANKED_START ? '–' : `#${CHAMP_SLOT - i}`;
      const isNext  = !isPlayer && gs.currentOpponent && typeof gs.currentOpponent.divisionSlot === 'number' && i === gs.currentOpponent.divisionSlot;
      let mv = null;
      if (!isPlayer && f.prevSlot != null && f.prevSlot !== i) {
        mv = { delta: Math.abs(i - f.prevSlot), dir: i > f.prevSlot ? 'up' : 'down' };
      }
      const isNew = !isPlayer && !!f.isNew;
      rows.push({ i, f, fid, isPlayer, isChamp: i === CHAMP_SLOT, isNext, rankNum, mv, isNew });
    }
    return rows;
  })());

  // ── Sidebar: ranking-row hover popup ──────────────────
  let hoverPop = $state(null);   // { x, y, slotIdx, name, record, rate, rateColor, clfEmoji, clfLabel, style, rising }

  // Hover isn't available on touch devices, and the left-anchored popup has no
  // room in the single-column layout (≤768px). In both cases the popup becomes a
  // tap-driven bottom sheet (with a "Call out" button when a callout is available).
  let isTouch  = $state(false);
  let isNarrow = $state(false);
  const useSheet = $derived(isTouch || isNarrow);
  onMount(() => {
    isTouch = window.matchMedia?.('(hover: none)').matches ?? false;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => (isNarrow = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });

  // Row interaction: hover opens the popup on wide pointer layouts; in sheet mode
  // a tap toggles it. The bare row-tap no longer triggers a callout in sheet mode
  // — that's the popup's button — so info is always reachable without a mouse.
  function onRowEnter(e, row) { if (!useSheet) showRowPop(e, row); }
  function onRowLeave()       { if (!useSheet) hoverPop = null; }
  function onRowClick(e, row) {
    if (row.isPlayer) return;
    if (useSheet) {
      if (hoverPop && hoverPop.slotIdx === row.i) hoverPop = null;
      else showRowPop(e, row);
    } else if (canCallout) {
      openCallout(row.i);
    }
  }

  function showRowPop(e, row) {
    if (row.isPlayer || !gs.career) { hoverPop = null; return; }
    const f   = row.f;
    const cs  = gs.career;
    const w = f.wins || 0, l = f.losses || 0, d = f.draws || 0;
    const total = w + l + d;
    const rate  = total > 0 ? Math.round((100 * w) / total) : 0;
    const rateColor = rate >= 70 ? 'var(--green)' : rate >= 50 ? 'var(--amber, #e8c14a)' : 'var(--red)';
    const clf = classifyFighter(f, row.i, cs.phase, row.isChamp);
    const rect = e.currentTarget.getBoundingClientRect();
    const h2h  = gs.h2h?.[row.fid];
    const h2hTotal = h2h ? (h2h.w + h2h.l + h2h.d) : 0;
    const vsRecord = h2hTotal > 0
      ? `${h2h.w}W-${h2h.l}L${h2h.d > 0 ? `-${h2h.d}D` : ''}`
      : null;

    // Build fighter avatar for the popup.
    const look = f.look
      || ethnicAvatar(surnameLookOverride(f.name) || f.ethnicity || ethForNationality(f.nationality), row.fid || f.name || 'x');
    const iso = COUNTRY_BY_NAME[f.nationality]?.iso || '';
    const fit = nationalityFit(iso, 0);
    const avatar = { ...look, shortsBase: fit.main || '#181820', shortsTrim: fit.trim || '#e8e8ec', org: divisionPants(cs) };
    const beltType  = row.isChamp ? divisionBeltType(cs)  : null;
    const beltColor = row.isChamp ? divisionBeltColor(cs) : null;

    hoverPop = {
      // Anchor to the LEFT of the row (sidebar sits on the right edge of the screen).
      x: rect.left,
      y: rect.top + rect.height / 2,
      slotIdx: row.i,
      name: f.name,
      record: f.record,
      rate, rateColor, total,
      clfEmoji: clf.emoji, clfLabel: clf.label,
      style: f.style || '',
      rising: !!f.isRising,
      vsRecord,
      avatar, beltType, beltColor,
    };
  }

  // ── Sidebar: callout (result screen only) ─────────────
  let calloutTargetSlot = $state(null);
  let calloutFighter    = $state(null);
  let calloutPct        = $state(0);
  let calloutOddsDesc   = $state('');
  let calloutResult     = $state(null);
  let calloutResultText = $state('');
  let calloutAccepted   = $state(false);

  // Current event name shown on the opponent card
  const currentEventName = $derived((() => {
    const cs = gs.career;
    if (!cs || gs.sparring) return '';
    const phase = cs.phase || 1;
    const evNum = cs.gflEventNum || 1;
    if (phase === 3) {
      const pSlot = cs.division?.playerSlot ?? 0;
      if (pSlot >= CHAMP_SLOT - 5) {
        const city = gs.currentOpponent?.gflCity;
        return city ? `GFL ${evNum} · ${city}` : `GFL ${evNum}`;
      }
      return 'GFL Fight Night';
    }
    if (phase === 2) return cs.phase2Name || 'Apex Combat';
    return cs.phase1OrgName || 'Regional FC';
  })());

  // Every 3rd defence is mandatory (defenseStreak of 2, 5, 8… means next is the 3rd, 6th, 9th…)
  const isMandatoryDefense = $derived(
    !!(gs.career?.titleHeld) && (gs.career?.defenseStreak ?? 0) % 3 === 2
  );

  const canCallout = $derived(
    gs.screen === 'result' &&
    !gs.calloutUsed &&
    !!gs.fightResult &&
    !gs.fightResult?.isLast &&
    !isMandatoryDefense
  );

  function openCallout(slotIdx) {
    if (!canCallout) return;
    const cs = gs.career;
    if (!cs?.division) return;
    const fid = cs.division.slots[slotIdx];
    if (!fid || fid === 'player') return;
    const f = gf(fid);
    if (!f) return;
    calloutTargetSlot = slotIdx;
    calloutFighter    = f;
    const playerSlot  = cs.division.playerSlot;
    const isChamp     = playerSlot === CHAMP_SLOT;
    const penalty     = cs.calloutRecord?.[f.name] || 0;
    const defenses    = cs.champCalloutClout || 0;
    const pct         = calloutSuccessPct(playerSlot, slotIdx, penalty, defenses);
    calloutPct        = Math.round(pct * 100);
    if (isChamp) {
      const diff = CHAMP_SLOT - slotIdx; // how far below #1 contender
      if (diff <= 1)      calloutOddsDesc = 'The #1 contender — a natural title defence.';
      else if (diff <= 3) calloutOddsDesc = 'A fringe contender — the organisation may not push for this.';
      else if (diff <= 6) calloutOddsDesc = 'Well outside the title picture — unlikely to get sanctioned.';
      else                calloutOddsDesc = 'Far too low in the rankings — the organisation won\'t want this fight.';
      if (penalty > 0) calloutOddsDesc += ` You've already beaten them ${penalty} time${penalty > 1 ? 's' : ''} — they have nothing to gain from a rematch.`;
    } else {
      const diff = slotIdx - playerSlot;
      if (diff <= 0)       calloutOddsDesc = diff === 0 ? 'Same rank — they have little reason to refuse.' : 'They are ranked below you.';
      else if (diff <= 3)  calloutOddsDesc = 'Close in the rankings — this is a natural matchup.';
      else if (diff <= 8)  calloutOddsDesc = 'A few spots above you — they might not see you as worthy yet.';
      else                 calloutOddsDesc = 'Far above your current ranking — expect a cold shoulder.';
      if (penalty > 0) calloutOddsDesc += ` They have lost to you ${penalty} time${penalty > 1 ? 's' : ''} — reluctant to fight again.`;
    }
    calloutResult   = null;
    calloutAccepted = false;
  }

  function doCallout() {
    const cs = gs.career;
    if (calloutTargetSlot === null || !cs?.division) return;
    const fid    = cs.division.slots[calloutTargetSlot];
    const f      = gf(fid);
    if (!f) return;
    const isChamp  = cs.division.playerSlot === CHAMP_SLOT;
    const penalty  = cs.calloutRecord?.[f.name] || 0;
    const defenses = cs.champCalloutClout || 0;
    const pct      = calloutSuccessPct(cs.division.playerSlot, calloutTargetSlot, penalty, defenses);
    const accepted = Math.random() < pct;
    gs.calloutUsed = true;
    if (accepted) {
      calloutResult     = 'accepted';
      calloutResultText = '✓ They accepted. The fight is on.';
      calloutAccepted   = true;
      gs._calloutOpponent = divisionSlotToOpponent(fid, calloutTargetSlot, cs);
      // Reset accumulated callout clout if champion called out someone outside the top 5
      if (isChamp && (CHAMP_SLOT - calloutTargetSlot) > 5) {
        cs.champCalloutClout = 0;
      }
    } else {
      const reasons = isChamp ? [
        "The organisation didn't want this fight made.",
        "They didn't think they were ready for a title shot.",
        "The promotion felt it was too early for them.",
        "They turned it down — not confident they've earned a shot.",
        "The matchmakers blocked it. That name isn't in the title conversation.",
      ] : [
        'Not interested. You have not earned it yet.',
        'Their team passed. Work your way up.',
        'They want bigger names first.',
        'Management declined. Try again after a win.',
      ];
      calloutResult     = 'declined';
      calloutResultText = '✗ ' + reasons[Math.floor(Math.random() * reasons.length)];
    }
  }

  function acceptCalloutFight() {
    if (!gs._calloutOpponent) return;
    gs.currentOpponent  = gs._calloutOpponent;
    gs._calloutOpponent = null;
    calloutTargetSlot   = null;
    calloutResult       = null;
    gs.calloutUsed      = false;
    gs.screen           = 'prefight';
  }

  function closeCallout() {
    calloutTargetSlot   = null;
    calloutResult       = null;
    gs._calloutOpponent = null;
  }

  // ── Layout flags ──────────────────────────────────────
  const IN_GAME_SCREENS = ['prefight', 'question', 'result'];
  const inGame   = $derived(IN_GAME_SCREENS.includes(gs.screen));
  const showSide = $derived(inGame && !gs.sparring && !!gs.career);

  // ── Back bar: display name ────────────────────────────
  let displayName = $state('');
  let profile     = $state(null);

  // ── Save counts (for menu panels) ────────────────────
  let saveCount   = $state(0);
  let historyCount = $state(0);

  const userLimits = $derived(getUserLimits(profile));

  async function refreshCounts() {
    const sess = get(session);
    if (!sess) return;
    try {
      const [saves, hist] = await Promise.all([
        loadAllSaves(sess.user.id, 'mma'),
        loadPastCareers(sess.user.id, 'mma'),
      ]);
      saveCount    = saves.length;
      historyCount = hist.length;
    } catch { /* ignore */ }
  }

  // ── Module loading ────────────────────────────────────
  async function loadModules() {
    try {
      const filenames = await fetchIndex();
      const sets = await Promise.all(filenames.map(async f => {
        try   { return { id: f.replace('.json', ''), filename: f, ...(await fetchSet(f)) }; }
        catch { return null; }
      }));
      gs.availableModules = sets.filter(Boolean);
      gs.loadedModules    = {};
      for (const m of gs.availableModules) gs.loadedModules[m.id] = m;
    } catch (e) {
      console.error('Failed to load question modules:', e);
    }
  }

  // ── Save status banner ────────────────────────────────
  let saveError = $state(null);
  // Full-screen "Saving…" overlay shown while a save round-trip is in flight.
  let savingExit = $state(false);

  // ── Cloud save ────────────────────────────────────────
  // Returns true on success, false on failure (with saveError set).
  async function saveToCloud() {
    const sess = get(session);

    // Fire-and-forget answer log + FSRS update (never blocks save)
    if (sess && gs.fightResult && (gs.activeSetMeta || gs.fightResult.q?.__setId)) {
      const { ratio, score, maxPts, q } = gs.fightResult;
      // In group play each question carries its origin set, so progress is
      // attributed to the real member set rather than the synthetic group id.
      const meta = q?.__setId
        ? { setId: q.__setId, source: q.__setSource, name: q.__setName }
        : gs.activeSetMeta;
      logAnswer(
        sess.user.id, q, meta,
        gs.sparring ? 'mma_sparring' : 'mma',
        ratio, score, maxPts
      ).then(() => {
        // Sync _qScores from updated FSRS difficulty once the DB write completes
        const qid = String(q?.id ?? q?._id ?? q?.question ?? '');
        if (qid && gs._srStates?.get?.(qid)) {
          gs._qScores[qid] = difficultyToQScore(gs._srStates.get(qid).difficulty);
        }
      });
    }

    if (!sess) { saveError = 'Not logged in — cannot save. Log in to save careers.'; return false; }
    if (!gs.career) return false;
    try {
      const blob        = exportSave(gs);
      const fighterName = gs.career.fighterName || null;
      if (gs.saveId) {
        await updateSave(gs.saveId, blob, fighterName);
      } else {
        const newId = await createSave(sess.user.id, 'mma', blob, fighterName);
        gs.saveId = newId;
        saveCount = saveCount + 1;
      }
      saveError = null;
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      saveError = `Save failed: ${e?.message || e?.code || 'unknown error'}`;
      return false;
    }
  }

  // ── Save & Exit (suspend career, return to menu) ──────
  async function saveAndExit() {
    if (savingExit) return;          // ignore double-clicks while a save is in flight
    savingExit = true;
    try {
      const ok = await saveToCloud();
      if (!ok) return;               // keep the player on the current screen so the error banner is visible
      // Clear the in-memory career so MenuScreen shows the main menu,
      // not the mid-career switcher. The career is safely persisted in the DB.
      gs.career          = null;
      gs.currentOpponent = null;
      gs.saveId          = null;
      gs.sparring        = false;
      gs.screen          = 'menu';
      await refreshCounts();
    } finally {
      savingExit = false;
    }
  }

  // ── Career end → archive + delete active save ─────────
  async function onCareerEnd() {
    const sess = get(session);

    // Stamp retireType on the career object before anything else, so
    // buildLegacyStats() and the EndScreen both read the same value.
    const cs = gs.career;
    if (cs) {
      if (!cs.retireType) cs.retireType = deriveRetireType(cs, gs);
    }

    if (!sess || !cs) {
      gs.screen = 'end';
      return;
    }

    const careerFull = buildLegacyStats(gs);
    const legacy     = calcLegacyTitle(careerFull);
    const record     = `${gs.wins}-${gs.losses + gs.finishes}-${gs.draws}`;
    const highestPhase = gs.career.highestPhase ?? gs.career.phase ?? 1;
    // getPhaseDef applies the per-career phase-2 org override (e.g. Kings FC).
    const highestOrg   = getPhaseDef({ ...cs, phase: highestPhase }).promo ?? 'Regional FC';
    const titles  = gs.career.titles || {};
    const champCount  = [1, 2, 3].reduce((n, ph) => n + (titles[ph]?.reigns || 0), 0);
    const maxDefenses = [1, 2, 3].reduce((m, ph) => Math.max(m, titles[ph]?.bestDefenseStreak || 0), 0);
    const highestBeltPhase = [3, 2, 1].find(ph => (titles[ph]?.reigns || 0) > 0) ?? null;
    const highestBeltType  = !highestBeltPhase ? null
      : highestBeltPhase === 3 ? 'gfl'
      : highestBeltPhase === 2 ? (/king/i.test(cs.phase2Name || '') ? 'kfc' : 'apex')
      : 'regional';
    const statBreakdown = {
      wins: gs.wins, losses: gs.losses, draws: gs.draws,
      finishes: gs.finishes, fightIndex: gs.fightIndex,
      winsByKO: gs.winsByKO, winsByTKO: gs.winsByTKO,
      winsBySub: gs.winsBySub, winsByDec: gs.winsByDec,
      bestStreak: gs.bestStreak, bestUnbeatenStreak: gs.bestUnbeatenStreak,
      champCount,
      defenseStreak: maxDefenses,
      avatar: cs.avatar ?? null,
      highestBeltType,
      // Per-organisation belts
      titles: [1, 2, 3].map(ph => {
        const d = getPhaseDef({ ...cs, phase: ph });
        return {
          org:    d.promo ?? `Phase ${ph}`,
          belt:   d.rankLabels?.[11] ?? 'Champion',
          reigns: titles[ph]?.reigns || 0,
          bestDefenseStreak: titles[ph]?.bestDefenseStreak || 0,
        };
      }).filter(t => t.reigns > 0),
    };
    try {
      const histId = await archiveCareer(sess.user.id, 'mma', {
        fighterName: gs.career.fighterName,
        finalRecord: record,
        legacyTitle: legacy,
        highestOrg,
        statBreakdown,
      });
      if (gs.saveId) {
        await deleteSave(gs.saveId);
        saveCount    = Math.max(0, saveCount - 1);
        historyCount = historyCount + 1;
      }
      gs._newHistoryId = histId;   // highlights the entry if/when Past Careers is opened
      gs.saveId        = null;
      // Show the end-of-career summary (Run It Back / Main Menu). The career is
      // archived in the background and reachable from the menu's Past Careers panel.
      // Going to 'end' (not 'past_careers') also avoids leaving a stale gs.career
      // that would make the menu show the mid-career switcher.
      gs.screen        = 'end';
    } catch (e) {
      console.error('Archive failed:', e);
      saveError = `Could not save completed career: ${e?.message || e?.code || 'unknown error'}`;
      gs.screen = 'end';
    }
  }

  // ── Load a specific save ──────────────────────────────
  async function loadCareer(saveId, saveDataBlob) {
    let blob = saveDataBlob;
    if (!blob) {
      const row = await loadSaveById(saveId);
      if (!row) return;
      blob = row.save_data;
    }
    if (!blob) return;
    loadSave(gs, blob);
    gs.saveId = saveId;

    // Guard: if the loaded career is already in a terminal state, the active save is
    // orphaned — archiving succeeded but delete failed. Clean up the save and send
    // straight to the end summary; don't re-archive (it's already in Past Careers).
    const cs = gs.career;
    if (cs) {
      const voluntarilyOut = !!cs.retiredVoluntarily;
      const durabilityGone = (cs.durability ?? 100) <= 0;
      const forcedOut      = !!cs.forceRetire;
      if (voluntarilyOut || durabilityGone || forcedOut) {
        gs.retiredVoluntarily = voluntarilyOut;
        gs.retiredDurability  = durabilityGone && !forcedOut && !voluntarilyOut;
        gs.retiredForcefully  = forcedOut && !voluntarilyOut;
        try { await deleteSave(gs.saveId); } catch {}
        gs.saveId = null;
        gs.screen = 'end';
        return;
      }
    }
  }

  // ── onMount ───────────────────────────────────────────
  onMount(async () => {
    await loadModules();
    const sess = get(session);
    if (sess) {
      // Fetch profile for display name + tier
      supabase
        .from('profiles')
        .select('display_name, tier')
        .eq('id', sess.user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            displayName = data.display_name;
            profile     = data;
          }
        });
      // Load save counts for menu panels
      refreshCounts();
    }
    // Deep-link from dashboard
    const continueId = $page.url.searchParams.get('continue');
    const urlScreen  = $page.url.searchParams.get('screen');
    if (continueId && sess) {
      // Resume a specific career directly (Continue from the dashboard).
      try {
        await loadCareer(continueId);   // loadSave routes to the prefight screen
      } catch (e) {
        console.error('Could not resume career:', e);
        gs.screen = 'saved_careers';
      }
    } else if (urlScreen === 'saved_careers' || urlScreen === 'past_careers') {
      gs.screen = urlScreen;
    }
    // Strip deep-link params so a later reload starts at the menu instead of
    // re-triggering the same career load / screen.
    if (continueId || urlScreen) {
      window.history.replaceState(window.history.state, '', '/mma');
    }
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="/mma.css" />
</svelte:head>

<div class="mma-wrap" class:in-game={inGame} class:sparring={gs.sparring}>

  <div class="back-bar">
    <a href="/games" class="back-link">
      <span class="back-arrow">←</span> All Games
    </a>
    <a href="/" class="back-logo">Mc<span>Chimp</span></a>
    <div class="back-right">
      {#if $session}
        <div class="back-user-wrap">
          <a href="/account" class="back-user">{displayName || 'Account'} ▾</a>
          <div class="back-dropdown">
            <a href="/dashboard">Dashboard</a>
            <a href="/account">Settings</a>
          </div>
        </div>
      {:else}
        <a href="/auth/login" class="back-login">Login</a>
      {/if}
    </div>
  </div>

  <header class="mma-header">
    <h1 class="mma-title">MMA Career Simulator</h1>
    {#if !gs.sparring && gs.career}
      <div class="score-display">
        <span class="score-w">{gs.wins}W</span>
        <span class="score-sep">–</span>
        <span class="score-l">{gs.losses + gs.finishes}L</span>
        <span class="score-sep">–</span>
        <span class="score-d">{gs.draws}D</span>
      </div>
    {/if}
  </header>

  {#if saveError}
    <div class="save-error-banner" role="alert">
      <span class="seb-text">⚠ {saveError}</span>
      <button class="seb-close" onclick={() => saveError = null} aria-label="Dismiss">✕</button>
    </div>
  {/if}

  {#if savingExit}
    <div class="saving-overlay" role="status" aria-live="polite">
      <div class="saving-box">
        <div class="saving-spinner"></div>
        <div class="saving-text">Saving your career…</div>
      </div>
    </div>
  {/if}

  {#if gs.screen !== 'menu' && gs.screen !== 'end' && gs.screen !== 'saved_careers' && gs.screen !== 'past_careers'}
    <div class="fight-meta">
      {#if gs.sparring}
        {#if gs.fightIndex > 0}
          <span class="fight-count">Round {gs.fightIndex}</span>
        {/if}
      {:else}
        <span class="fight-count">
          Fight {gs.fightIndex + 1}{gs.career?.activeLength > 0
            ? ` of ${gs.career.activeLength}`
            : ' · Until Retirement'}
        </span>
      {/if}
    </div>
  {/if}

  {#if gs.sparring && inGame}
    <div class="sparring-banner">⚡ Sparring Mode — No record tracked</div>
  {/if}

  <div class="layout-wrap">

    <div class="game-col">

      {#if gs.screen === 'menu'}
        <MenuScreen
          {saveCount}
          {historyCount}
          {userLimits}
          onsavedcareers={() => { gs.screen = 'saved_careers'; }}
          onpastcareers={() => { gs.screen = 'past_careers'; }}
          onstartcareer={(e) => {
            initState(gs, e.modId);
            gs.career.activeLength = e.length;
            gs.career.difficulty   = e.difficulty;
            gs.saveId = null;
          }}
          onstartsparring={(e) => initSparringState(gs, e.modId)}
        />

      {:else if gs.screen === 'saved_careers'}
        <SavedCareersScreen
          onloadcareer={async (saveId, blob) => { await loadCareer(saveId, blob); }}
          onnewcareer={() => {
            initState(gs, gs.activeModId || gs.availableModules?.[0]?.id);
            gs.saveId = null;
          }}
          onback={() => { gs.screen = 'menu'; }}
        />

      {:else if gs.screen === 'past_careers'}
        <PastCareersScreen onback={() => { gs.screen = 'menu'; }} />

      {:else if gs.screen === 'naming'}
        <NamingScreen onsave={saveToCloud} />

      {:else if gs.screen === 'prefight'}
        <PrefightScreen onsaveexit={saveAndExit} />

      {:else if gs.screen === 'question'}
        <QuestionScreen onsave={saveToCloud} />

      {:else if gs.screen === 'result'}
        <ResultScreen
          onsave={saveToCloud}
          onsaveexit={saveAndExit}
          oncareerend={onCareerEnd}
        />

      {:else if gs.screen === 'career_end'}
        <CareerEndScreen oncareerend={onCareerEnd} />

      {:else if gs.screen === 'end'}
        <EndScreen onrestart={() => { gs.screen = 'menu'; }} />
      {/if}

    </div>

    {#if showSide}
      <aside class="career-col">

        <!-- 1. Career panel (stats) -->
        <CareerPanel />

        <!-- 2. Next opponent card -->
        {#if gs.currentOpponent}
          {@const opp = gs.currentOpponent}
          <div class="sidebar-opp">
            {#if currentEventName}
              <div class="so-event">{currentEventName}</div>
            {/if}
            <div class="so-label">Your Opponent</div>
            <div class="so-head">
              <div class="so-head-text">
                <div class="so-name">{opp.name}</div>
                <div class="so-row2">
                  <span class="so-record">{opp.record}</span>
                  {#if opp.badge}
                    <span class="so-badge {opp.badgeClass}">{opp.badge}</span>
                  {/if}
                </div>
              </div>
              {#if oppAvatar}
                <div class="so-avatar"><FighterAvatar avatar={oppAvatar} org={oppPants} beltType={oppBeltType} beltColor={oppBelt} gloveColor={oppGlove} size={64} /></div>
              {/if}
            </div>
            {#if opp.classLabel || opp.style}
              <div class="so-class">
                {#if opp.classLabel}{opp.classEmoji} {opp.classLabel}{/if}{#if opp.classLabel && opp.style} · {/if}{#if opp.style}<span class="so-style">{opp.style}</span>{/if}
              </div>
            {/if}
            {#if opp.nationality}
              <div class="so-nat">{opp.flag} {opp.nationality}</div>
            {/if}
            {#if gs.h2h?.[opp.fid] && (gs.h2h[opp.fid].w + gs.h2h[opp.fid].l + gs.h2h[opp.fid].d) > 0}
              {@const h = gs.h2h[opp.fid]}
              <div class="so-h2h">vs YOU · {h.w}W-{h.l}L{h.d > 0 ? `-${h.d}D` : ''}</div>
            {/if}
            {#if opp.bio}
              <div class="so-bio">{opp.bio}</div>
            {/if}
            {#if opp.venue}
              <div class="so-venue">📍 {opp.venue}</div>
            {/if}
          </div>
        {/if}

        <!-- 3. Divisional news (prefight only) -->
        {#if gs.screen === 'prefight' && gs.career?.divisionNews?.length}
          {@const pDef = getPhaseDef(gs.career)}
          <div class="sidebar-news">
            <button class="sn-header" onclick={() => { gs.career.newsFolded = !gs.career.newsFolded; }}>
              <span>{pDef.promo} · News</span>
              <span class="sn-toggle">{gs.career.newsFolded ? '▶' : '▼'}</span>
            </button>
            {#if !gs.career.newsFolded}
              <ul class="sn-list">
                {#each gs.career.divisionNews as item}
                  <li class="sn-item sn-{item.type}">{item.text}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        <!-- 4. Rankings table -->
        {#if gs.career?.division && rankingRows.length}
          {@const pDef = getPhaseDef(gs.career)}
          <div class="sidebar-rankings">
            <div class="rt-header">
              {pDef.promo} Rankings
              {#if gs.screen === 'result'}
                {#if isMandatoryDefense}
                  <span class="rt-callout-hint mandatory">mandatory defence</span>
                {:else if canCallout}
                  <span class="rt-callout-hint">tap to call out</span>
                {:else if gs.calloutUsed}
                  <span class="rt-callout-hint used">callout used</span>
                {/if}
              {/if}
            </div>
            <table class="rt-table">
              <thead><tr><th>Rank</th><th>Fighter</th><th>Record</th></tr></thead>
              <tbody>
                {#each rankingRows as row (row.i)}
                  <tr
                    class:rt-player={row.isPlayer}
                    class:rt-champ={row.isChamp}
                    class:rt-next={row.isNext}
                    class:rt-clickable={!row.isPlayer && (canCallout || useSheet)}
                    onclick={(e) => onRowClick(e, row)}
                    role={!row.isPlayer && (canCallout || useSheet) ? 'button' : undefined}
                    tabindex={!row.isPlayer && (canCallout || useSheet) ? 0 : undefined}
                    onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !row.isPlayer && canCallout) openCallout(row.i); }}
                    onmouseenter={(e) => onRowEnter(e, row)}
                    onmouseleave={onRowLeave}
                  >
                    <td class="rt-rank">{row.rankNum}</td>
                    <td class="rt-name">
                      {#if row.f.flag}<span class="rt-flag">{row.f.flag}</span> {/if}{row.f.name}
                      {#if row.isPlayer}<span class="rt-you">YOU</span>{/if}
                      {#if row.isNext}<span class="rt-next-badge">NEXT</span>{/if}
                      {#if gs.screen === 'prefight'}
                        {#if row.isNew}<span class="rt-new">NEW</span>{/if}
                        {#if row.mv}
                          {#if row.mv.dir === 'up'}
                            <span class="rt-mv-up">▲{row.mv.delta}</span>
                          {:else}
                            <span class="rt-mv-dn">▼{row.mv.delta}</span>
                          {/if}
                        {/if}
                      {/if}
                    </td>
                    <td class="rt-rec">{row.f.record}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <!-- 4. Bout history -->
        <BoutHistory />

      </aside>
    {/if}

    <!-- Ranking-row popup: hover-anchored on pointer devices, a tap-driven
         bottom sheet on touch (with a Call out button when one is available). -->
    {#if hoverPop}
      {#if useSheet}
        <div class="rtp-backdrop" role="presentation" onclick={() => (hoverPop = null)}></div>
      {/if}
      <div
        class="rt-popup {useSheet ? 'rtp-sheet' : ''}"
        style={useSheet ? '' : `left: ${hoverPop.x}px; top: ${hoverPop.y}px;`}
      >
        <div class="rtp-body">
          <div class="rtp-avatar">
            <FighterAvatar avatar={hoverPop.avatar} beltType={hoverPop.beltType} beltColor={hoverPop.beltColor} size={48} />
          </div>
          <div class="rtp-text">
            <div class="rtp-name">{hoverPop.name}</div>
            <div class="rtp-rec">
              {hoverPop.record} · <span style="color: {hoverPop.rateColor}">{hoverPop.rate}%</span> ({hoverPop.total} fights)
            </div>
            <div class="rtp-clf">
              {hoverPop.clfEmoji} {hoverPop.clfLabel}{#if hoverPop.style} · <span class="rtp-style">{hoverPop.style}</span>{/if}
            </div>
            {#if hoverPop.rising}
              <div class="rtp-rising">🚀 Hot Prospect</div>
            {/if}
            {#if hoverPop.vsRecord}
              <div class="rtp-vs">vs YOU · {hoverPop.vsRecord}</div>
            {/if}
          </div>
        </div>
        {#if useSheet && canCallout}
          <button class="rtp-callout" onclick={() => { openCallout(hoverPop.slotIdx); hoverPop = null; }}>
            📢 Call out {hoverPop.name}
          </button>
        {/if}
      </div>
    {/if}

  </div>

</div>

<!-- ── Callout modal ── -->
{#if calloutTargetSlot !== null}
  <div class="callout-overlay" role="dialog" aria-modal="true" tabindex="-1"
    onclick={closeCallout}
    onkeydown={(e) => e.key === 'Escape' && closeCallout()}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="callout-inner" role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}>
      <div class="callout-title">Call Out</div>
      {#if calloutFighter}
        <div class="callout-fighter">{calloutFighter.name} ({calloutFighter.record})</div>
      {/if}
      <div class="callout-odds">
        {calloutOddsDesc}<br>
        <span style="color:var(--accent);font-weight:600">{calloutPct}% chance they accept.</span>
      </div>
      {#if calloutResult}
        <div class="callout-result {calloutResult}">{calloutResultText}</div>
        <div class="callout-btns">
          {#if calloutAccepted}
            <button class="btn btn-primary" onclick={acceptCalloutFight}>Fight Them</button>
          {/if}
          <button class="btn btn-ghost" onclick={closeCallout}>Close</button>
        </div>
      {:else}
        <div class="callout-btns">
          <button class="btn btn-primary" onclick={doCallout}>Call Them Out</button>
          <button class="btn btn-ghost" onclick={closeCallout}>Cancel</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .back-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 10px 32px;
    background: rgba(10,10,10,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 200;
    flex-shrink: 0;
  }
  .back-link {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(242,239,232,0.45);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: color 0.15s;
  }
  .back-link:hover { color: #F2EFE8; }
  .back-arrow { font-size: 16px; line-height: 1; }
  .back-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 20px;
    letter-spacing: 0.06em;
    color: #E8C14A;
    text-decoration: none;
    justify-self: center;
  }
  .back-logo span { color: #F2EFE8; opacity: 0.5; }

  .back-right { margin-left: auto; justify-self: end; }

  .back-user-wrap {
    position: relative;
    display: inline-flex;
  }
  .back-user {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #E8C14A;
    border: 1px solid rgba(232,193,74,0.4);
    padding: 5px 14px;
    border-radius: 2px;
    text-decoration: none;
    transition: background 0.2s;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
  }
  .back-user:hover { background: rgba(232,193,74,0.08); }

  .back-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: max-content;
    background: #0F1011;
    border: 1px solid rgba(255,255,255,0.08);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity 0.15s, transform 0.15s;
    z-index: 300;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
  }
  .back-user-wrap:hover .back-dropdown {
    opacity: 1;
    pointer-events: all;
    transform: translateY(0);
  }
  .back-dropdown a {
    display: block;
    padding: 12px 18px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #F2EFE8;
    text-decoration: none;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.12s;
  }
  .back-dropdown a:last-child { border-bottom: none; }
  .back-dropdown a:hover { background: #191B1D; }

  .back-login {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #E8C14A;
    border: 1px solid rgba(232,193,74,0.4);
    padding: 5px 14px;
    border-radius: 2px;
    text-decoration: none;
    transition: background 0.2s;
  }
  .back-login:hover { background: rgba(232,193,74,0.08); }

  .mma-wrap {
    width: 100%;
    display: flex; flex-direction: column; min-height: 100vh;
  }
  .mma-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    width: 100%;
  }
  .mma-title { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); }
  .score-display { display: flex; gap: 16px; font-family: var(--font-display); font-size: 20px; letter-spacing: 0.03em; }
  .score-w  { color: var(--green); }
  .score-sep { color: var(--text-muted); }
  .score-d  { color: var(--amber); }
  .score-l  { color: var(--red); }
  .fight-meta  { padding: 8px 32px 0; }
  .fight-count { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
  .sparring-banner {
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #b44ae8;
    background: rgba(180,74,232,0.10); border: 1px solid rgba(180,74,232,0.25);
    border-radius: var(--radius); padding: 6px 14px; margin: 8px 32px 0; text-align: center;
  }
  .save-error-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    font-size: 13px; color: var(--red);
    background: rgba(232,74,74,0.10); border: 1px solid rgba(232,74,74,0.35);
    border-radius: var(--radius); padding: 10px 16px; margin: 12px 32px 0;
  }
  .seb-text  { line-height: 1.4; }
  .seb-close { background: none; border: none; color: var(--red); cursor: pointer; font-size: 14px; padding: 2px 6px; flex-shrink: 0; }
  .seb-close:hover { opacity: 0.7; }
  .layout-wrap {
    display: flex; flex: 1; min-height: 0; align-items: stretch;
    width: 100%; max-width: 1400px; margin: 0 auto;
  }
  .mma-wrap:not(.in-game) .layout-wrap { display: block; padding: 0 24px; max-width: 860px; }
  .mma-wrap:not(.in-game) .game-col    { max-width: 100%; padding: 0; }
  .game-col {
    flex: 1;
    min-width: 0;
    padding: 28px 28px 40px;
  }
  .career-col {
    flex: 1 1 38%;
    min-width: 300px;
    max-width: 480px;
    border-left: 1px solid var(--border);
    padding: 20px 16px 40px;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
  }
  .mma-wrap.sparring.in-game .career-col { display: none; }
  .mma-wrap.sparring.in-game .game-col   { max-width: 760px; margin: 0 auto; }

  /* Sidebar: opponent card */
  .sidebar-opp {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 14px; margin-bottom: 14px;
  }
  .so-event  { font-family: var(--font-display); font-size: 22px; letter-spacing: 0.04em; line-height: 1.1; margin-bottom: 8px; color: var(--text); }
  .so-label  { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 3px; }
  .so-head   { display: flex; gap: 10px; align-items: flex-start; }
  .so-head-text { flex: 1; min-width: 0; }
  .so-avatar { flex-shrink: 0; width: 64px; height: 64px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .so-name   { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.04em; line-height: 1.1; margin-bottom: 4px; word-break: break-word; }
  .so-row2   { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
  .so-record { font-family: var(--font-display); font-size: 12px; color: var(--text-muted); }
  .so-badge  { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .oc-badge-ranked    { background: rgba(232,193,74,0.15); color: var(--accent); }
  .oc-badge-champ     { background: rgba(232,193,74,0.25); color: var(--accent); border: 1px solid var(--accent); }
  .oc-badge-contender { background: rgba(232,74,74,0.12);  color: var(--red); }
  .so-class  { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; color: var(--accent); }
  .so-style  { color: var(--text-muted); font-style: italic; font-weight: 600; }
  .so-bio    { font-size: 10px; color: var(--text-muted); line-height: 1.5; }
  .so-venue  { font-size: 9px; color: var(--text-muted); margin-top: 6px; letter-spacing: 0.05em; border-top: 1px solid var(--border); padding-top: 6px; }
  .so-nat    { font-size: 10px; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 4px; }
  .so-h2h    { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }

  /* Sidebar: divisional news */
  .sidebar-news { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 14px; }
  .sn-header {
    width: 100%; display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted);
    padding: 8px 12px; background: none; border: none; cursor: pointer;
    border-bottom: 1px solid var(--border);
  }
  .sn-header:hover { color: var(--text); }
  .sn-toggle { font-size: 8px; opacity: 0.6; }
  .sn-list { list-style: none; margin: 0; padding: 4px 0; }
  .sn-item { font-size: 11px; color: var(--text-muted); padding: 5px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); line-height: 1.4; }
  .sn-item:last-child { border-bottom: none; }
  .sn-item.sn-championship { color: var(--accent); }
  .sn-item.sn-prospect { color: var(--green); }

  /* Sidebar: rankings */
  .sidebar-rankings { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 14px; }
  .rt-header { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); padding: 8px 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .rt-callout-hint { font-size: 9px; letter-spacing: 0.08em; color: var(--accent); opacity: 0.8; }
  .rt-callout-hint.used { color: var(--text-muted); opacity: 0.4; }
  .rt-callout-hint.mandatory { color: var(--red, #c0392b); opacity: 1; }
  .rt-table  { width: 100%; border-collapse: collapse; font-size: 11px; }
  .rt-table thead th { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); padding: 4px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  .rt-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
  .rt-table tbody tr:last-child { border-bottom: none; }
  .rt-table td { padding: 5px 12px; }
  .rt-rank { font-family: var(--font-display); font-size: 12px; letter-spacing: 0.04em; color: var(--text-muted); width: 32px; }
  .rt-name { color: var(--text); font-size: 11px; }
  .rt-flag { font-size: 11px; margin-right: 6px; }
  .rt-rec  { color: var(--text-muted); font-size: 10px; text-align: right; }
  .rt-player { background: rgba(232,193,74,0.06); }
  .rt-player .rt-rank { color: var(--accent); }
  .rt-player .rt-name { color: var(--accent); font-weight: 600; }
  .rt-champ  .rt-rank { color: var(--accent); }
  .rt-next   { background: rgba(232,74,74,0.04); }
  .rt-next   .rt-rank { color: var(--red); }
  .rt-clickable { cursor: pointer; }
  .rt-clickable:hover td { background: rgba(255,255,255,0.04); }
  .rt-clickable:hover .rt-name { color: var(--accent); }
  .rt-you        { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; background: var(--accent); color: #0d0d0f; padding: 1px 4px; border-radius: 2px; font-weight: 700; margin-left: 5px; vertical-align: middle; }
  .rt-next-badge { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(232,74,74,0.2); color: var(--red); border: 1px solid rgba(232,74,74,0.4); padding: 1px 4px; border-radius: 2px; font-weight: 700; margin-left: 5px; vertical-align: middle; }
  .rt-new        { font-size: 9px; font-weight: 700; color: var(--blue); margin-left: 4px; letter-spacing: 0.08em; text-transform: uppercase; vertical-align: middle; }
  .rt-mv-up      { font-size: 10px; font-weight: 700; color: var(--green); margin-left: 4px; vertical-align: middle; }
  .rt-mv-dn      { font-size: 10px; font-weight: 700; color: var(--red);   margin-left: 4px; vertical-align: middle; }

  /* Ranking-row hover popup */
  .rt-popup {
    position: fixed;
    z-index: 200;
    /* anchored at the row's left edge & vertical centre → sit to the left of it */
    transform: translate(calc(-100% - 8px), -50%);
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 12px;
    min-width: 200px;
    max-width: 260px;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    line-height: 1.6;
  }
  .rtp-body  { display: flex; align-items: center; gap: 10px; }
  .rtp-avatar { flex-shrink: 0; }
  .rtp-text  { flex: 1; min-width: 0; }
  .rtp-name  { font-family: var(--font-display); font-size: 15px; letter-spacing: 0.04em; margin-bottom: 2px; color: var(--text); }
  .rtp-rec   { color: var(--text-muted); font-size: 11px; margin-bottom: 3px; }
  .rtp-clf   { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
  .rtp-style { color: var(--text-muted); font-style: italic; font-weight: 600; }
  .rtp-rising{ font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--green); margin-top: 3px; }
  .rtp-vs    { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); margin-top: 3px; }

  /* Touch / single-column layout: tap-driven centred modal replaces the hover popup. */
  .rtp-backdrop { position: fixed; inset: 0; z-index: 199; background: rgba(0,0,0,0.5); }
  .rt-popup.rtp-sheet {
    left: 50%; top: 50%; right: auto; bottom: auto;
    transform: translate(-50%, -50%);
    width: calc(100% - 32px);
    max-width: 320px;
    padding: 16px;
    pointer-events: auto;
  }
  .rtp-callout {
    margin-top: 14px;
    width: 100%;
    padding: 12px;
    background: var(--accent);
    color: #1A1A1A;
    border: none;
    border-radius: var(--radius);
    font-family: var(--font-display);
    font-size: 15px;
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  .rtp-callout:active { filter: brightness(0.92); }

  /* Saving overlay */
  .saving-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; z-index: 10000; }
  .saving-box { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .saving-spinner { width: 42px; height: 42px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: saving-spin 0.8s linear infinite; }
  .saving-text { font-family: var(--font-display); font-size: 16px; letter-spacing: 0.06em; color: var(--text); }
  @keyframes saving-spin { to { transform: rotate(360deg); } }

  /* Callout modal */
  .callout-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.80); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .callout-inner   { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 24px 20px; max-width: 360px; width: 90%; }
  .callout-title   { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); margin-bottom: 6px; }
  .callout-fighter { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .callout-odds    { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5; }
  .callout-result  { font-size: 13px; font-weight: 600; margin-bottom: 14px; padding: 8px 12px; border-radius: 4px; }
  .callout-result.accepted { background: rgba(74,232,122,0.12); color: var(--green); }
  .callout-result.declined { background: rgba(232,74,74,0.12);  color: var(--red); }
  .callout-btns { display: flex; gap: 10px; flex-wrap: wrap; }

  @media (max-width: 768px) {
    .mma-header    { padding: 14px 16px 12px; }
    .score-display { font-size: 16px; gap: 10px; }
    .fight-meta    { padding: 8px 16px 0; }
    .sparring-banner { margin: 8px 16px 0; }
    .layout-wrap   { flex-direction: column; }
    .game-col      { max-width: 100%; padding: 16px 16px 24px; }
    .career-col    { flex: none; width: 100%; max-width: 100%; min-width: 0; border-left: none; border-top: 1px solid var(--border); padding: 16px 16px 24px; position: static; max-height: none; overflow-y: visible; }
    .mma-wrap:not(.in-game) .layout-wrap { padding: 0 16px; }
  }
</style>
