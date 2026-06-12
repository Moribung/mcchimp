<!-- src/lib/mma/screens/CareerPanel.svelte -->
<!-- Stats only: name, record, rank, durability, champ, streaks, last 3, win/loss stats -->
<script>
  import { state as gs } from '$lib/mma/state.svelte.js';
  import {
    getPhaseDef, getPlayerSlot, slotToRankLabel, slotToCssClass, isUndefeated,
    divisionPants, divisionBeltColor, divisionBeltType, CHAMP_PANTS, gloveColorFor,
  } from '$lib/mma/career.js';
  import { CHAMP_SLOT } from '$lib/mma/constants.js';
  import { HAIR_STYLES, BEARD_STYLES } from '$lib/avatar/fighterRenderer.js';
  import { nationalityFit } from '$lib/avatar/nationalityFits.js';
  import FighterAvatar from '$lib/avatar/FighterAvatar.svelte';

  const cs      = $derived(gs.career);
  const pDef    = $derived(cs ? getPhaseDef(cs) : null);
  const slot    = $derived(cs ? getPlayerSlot(cs) : 0);
  const isChamp = $derived(slot === CHAMP_SLOT && !!cs?.titleHeld);

  // Avatar pants follow the current division; belt shown only while champion.
  const pants     = $derived(cs ? divisionPants(cs) : 'gfl');
  const beltType  = $derived(cs?.titleHeld ? divisionBeltType(cs) : null);
  const beltColor = $derived(cs?.titleHeld ? divisionBeltColor(cs) : null);
  // Championship bout (player challenging the champ, or champion defending) → gold gloves;
  // otherwise red for the higher-ranked fighter and blue for the lower-ranked one.
  const titleFight = $derived(!!cs && (gs.currentOpponent?.divisionSlot === CHAMP_SLOT || slot === CHAMP_SLOT));
  const gloveColor = $derived((() => {
    const oppSlot = gs.currentOpponent?.divisionSlot;
    if (!cs || oppSlot == null) return null;
    return gloveColorFor(slot, oppSlot, titleFight, true); // player wins ties (red)
  })());

  // ── Click-to-edit appearance popup (prefight only) ──
  let editOpen = $state(false);
  let dirty    = $state(false);  // any change made this session?
  const canEdit = $derived(gs.screen === 'prefight' && !!cs?.avatar);
  // The avatar can be customised once per round; after that, options grey out.
  const locked = $derived(!!cs && (cs.avatarEditFight ?? -1) === gs.fightIndex);

  // Pants colour presets for the popup.
  const PANTS_OPTS = $derived(cs ? [
    { id: 'custom',    label: 'Custom',     ...{ main: cs.avatar?.customBase, trim: cs.avatar?.customTrim } },
    { id: 'national1', label: 'National 1', ...nationalityFit(cs.playerNat || '', 0) },
    { id: 'national2', label: 'National 2', ...nationalityFit(cs.playerNat || '', 1) },
    ...(isChamp ? [{ id: 'champion', label: 'Champion', ...CHAMP_PANTS }] : []),
  ] : []);

  function setHair(h)  { if (locked) return; cs.avatar = { ...cs.avatar, hairStyle: h };  dirty = true; }
  function setBeard(b) { if (locked) return; cs.avatar = { ...cs.avatar, beardStyle: b }; dirty = true; }
  function setPants(opt) {
    if (locked) return;
    cs.avatar = { ...cs.avatar, pantsChoice: opt.id, shortsBase: opt.main, shortsTrim: opt.trim };
    dirty = true;
  }
  function closeEdit() {
    if (dirty && cs) cs.avatarEditFight = gs.fightIndex;  // consume this round's edit
    dirty = false;
    editOpen = false;
  }

  const rankText = $derived(
    !cs || !pDef ? '' :
    isChamp ? '🏆 ' + (cs.titleName || 'Champion') :
    slotToRankLabel(slot, pDef)
  );
  const rankClass = $derived(
    !cs ? '' : isChamp ? 'rank-champion' : slotToCssClass(slot)
  );
  // Per-organisation belts — separately tracked in cs.titles.
  // In-game we surface two summary badges (full per-org data is kept for the end screen):
  //   • Times champion — for the HIGHEST division ever held a belt in
  //   • Title defenses — defenses of the belt currently held
  const titleStats = $derived((() => {
    if (!cs?.titles) return { top: null, currentDefenses: 0 };
    let top = null;
    for (const ph of [1, 2, 3]) {
      const t = cs.titles[ph];
      if (t && t.reigns > 0) {
        // getPhaseDef applies the per-career phase-2 org override (e.g. Kings FC).
        const d = getPhaseDef({ ...cs, phase: ph });
        top = { phase: ph, org: d.promo ?? `Phase ${ph}`,
                belt: d.rankLabels?.[11] ?? 'Champion', reigns: t.reigns, held: t.held };
      }
    }
    const cur = cs.titles[cs.phase];
    const currentDefenses = (cur && cur.held) ? cur.defenseStreak : 0;
    return { top, currentDefenses };
  })());

  const ws  = $derived(Math.max(0, gs.currentStreak || 0));
  const ls  = $derived(Math.abs(Math.min(0, gs.currentStreak || 0)));
  const fs  = $derived(gs.finishStreak || 0);
  const ub  = $derived(gs.unbeatenStreak || 0);
  const und = $derived(cs ? isUndefeated(gs) : false);

  const streakTags = $derived((() => {
    const tags = [];
    // Championship badges first (most prestigious)
    if (titleStats.top) {
      const { reigns: r, belt, held } = titleStats.top;
      // belt already reads e.g. "GFL World Champion" — don't append another "Champion".
      // If the belt isn't currently held, mark it "Former".
      tags.push({
        cls:  held ? 'st-champ' : 'st-former',
        text: `👑 ${held ? '' : 'Former '}${r > 1 ? r + '× ' : ''}${belt}`,
      });
    }
    if (titleStats.currentDefenses > 0) {
      tags.push({ cls: 'st-defense', text: `🏆 ${titleStats.currentDefenses} title defense${titleStats.currentDefenses > 1 ? 's' : ''}` });
    }
    if (ls >= 2) tags.push({ cls: 'st-loss',       text: `💔 ${ls}-fight loss streak` });
    if (ws >= 2) tags.push({ cls: 'st-win',        text: `🔥 ${ws}-fight win streak` });
    if (fs >= 2) tags.push({ cls: 'st-finish',     text: `⚡ ${fs}-fight finish streak` });
    if (und)     tags.push({ cls: 'st-undefeated', text: '💎 Undefeated' });
    else if (ub > ws && ub >= 3) tags.push({ cls: 'st-unbeaten', text: `🛡 ${ub} unbeaten` });
    return tags;
  })());

  const statsData = $derived((() => {
    const w     = gs.wins;
    const l     = (gs.losses || 0) + (gs.finishes || 0);
    const total = w + l + (gs.draws || 0);
    if (total === 0) return null;
    const winRate = Math.round(100 * w / total);
    const wKO = gs.winsByKO || 0, wTKO = gs.winsByTKO || 0;
    const wSub = gs.winsBySub || 0, wDec = gs.winsByDec || 0;
    const lKO = gs.lossByKO || 0, lTKO = gs.lossByTKO || 0;
    const lSub = gs.lossBySub || 0, lDec = gs.lossByDec || 0;
    let winLabel = null;
    if (w >= 5) {
      const cats    = [['KO', wKO], ['TKO', wTKO], ['Sub', wSub], ['Dec', wDec]];
      const wMax    = Math.max(wKO, wTKO, wSub, wDec);
      const leaders = cats.filter(([, v]) => v === wMax).map(([k]) => k);
      const are = (...keys) => leaders.length === keys.length && keys.every(k => leaders.includes(k));

      if (wMax === 0)              winLabel = 'Allrounder';
      else if (leaders.length === 1) {
        if (wKO === wMax)         winLabel = 'KO Artist';
        else if (wTKO === wMax)   winLabel = 'Pressure Fighter';
        else if (wSub === wMax)   winLabel = 'Submission Artist';
        else                      winLabel = 'Decision Merchant';
      }
      // Co-dominant finish pairs get their own identity
      else if (are('KO', 'TKO'))  winLabel = 'Marauder';
      else if (are('TKO', 'Sub')) winLabel = 'Deep Water Specialist';
      // KO+Sub, anything tied with decisions, 3-/4-way ties → balanced
      else                        winLabel = 'Allrounder';
    }
    let lossLabel = null;
    if (l >= 5) {
      const lFinish = lKO + lTKO + lSub;
      if (lKO >= lTKO && lKO >= lSub && lKO > lDec)        lossLabel = 'Glass Chin';
      else if (lTKO >= lKO && lTKO >= lSub && lTKO > lDec) lossLabel = 'Gets Worn Down';
      else if (lSub >= lKO && lSub >= lTKO && lSub > lDec) lossLabel = 'Submission Vulnerable';
      else if (lDec >= lFinish)                             lossLabel = 'Goes the Distance';
    }
    return { winRate, w, l, wKO, wTKO, wSub, wDec, lKO, lTKO, lSub, lDec, winLabel, lossLabel };
  })());

  const last3 = $derived((() => {
    const raw = [...(gs.results || [])].slice(-3);
    while (raw.length < 3) raw.unshift(null);
    return raw;
  })());

  const dur      = $derived(typeof cs?.durability === 'number' ? cs.durability : 100);
  const durColor = $derived(dur > 60 ? 'var(--green)' : dur > 30 ? 'var(--amber)' : 'var(--red)');

  function voluntaryRetire() {
    if (!cs || gs.sparring) return;
    if (!confirm('Are you sure you want to retire? This will end your career.')) return;
    gs.retiredVoluntarily = true;
    // Route through 'career_end' (not 'end') so the career is archived to Past
    // Careers and the active save is removed — 'end' would skip onCareerEnd.
    gs.screen = 'career_end';
  }
</script>

{#if cs}
  <div class="career-panel">
    <div class="cp-header">
      <div class="cp-header-text">
        <div class="cp-fighter">{cs.fighterName}{cs.titleHeld ? ' 🏆' : ''}</div>
        <div class="cp-record-line">
          <span class="r-w">{gs.wins}</span>W&nbsp;–&nbsp;<span class="r-l">{gs.losses + gs.finishes}</span>L&nbsp;–&nbsp;<span class="r-d">{gs.draws}</span>D
        </div>
        <div class="cp-org-row">
          <span class="cp-promo">{pDef?.promo}</span>
          <span class="cp-rank {rankClass}">{rankText}</span>
        </div>
      </div>
      {#if cs.avatar}
        {#if canEdit}
          <button class="cp-avatar cp-avatar-btn" title="Change hair & beard" onclick={() => editOpen = true}>
            <FighterAvatar avatar={cs.avatar} org={pants} {beltType} {beltColor} {gloveColor} size={72} />
          </button>
        {:else}
          <div class="cp-avatar"><FighterAvatar avatar={cs.avatar} org={pants} {beltType} {beltColor} {gloveColor} size={72} /></div>
        {/if}
      {/if}
    </div>

    <div class="cp-divider"></div>

    <div class="durability-wrap">
      <div class="durability-row">
        <span class="durability-label">Durability</span>
        <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
          <span class="durability-value">{Math.round(dur)}%</span>
          <button class="cp-retire-btn" onclick={voluntaryRetire}>Retire</button>
        </div>
      </div>
      <div class="durability-bar-bg">
        <div class="durability-bar" style="width:{dur}%;background:{durColor}"></div>
      </div>
    </div>

    {#if streakTags.length > 0}
      <div class="cp-divider"></div>
      <div class="cp-streaks-wrap">
        {#each streakTags as tag}
          <span class="streak-tag {tag.cls}">{tag.text}</span>
        {/each}
      </div>
    {/if}

    <div class="cp-divider"></div>
    <div class="cp-last-row">
      <span class="cp-last-label">Last 3</span>
      <div class="cp-last">
        {#each last3 as r}
          <div class="cp-pip {r ? r.charAt(0) : 'empty'}"></div>
        {/each}
      </div>
    </div>

    {#if statsData}
      <div class="cp-divider"></div>
      <div class="cp-stats">
        <div class="cs-row"><span>Win rate</span><span>{statsData.winRate}%</span></div>
        {#if statsData.w > 0}
          <div class="cs-row">
            <span>Wins KO/TKO/Sub/Dec</span>
            <span>{statsData.wKO}/{statsData.wTKO}/{statsData.wSub}/{statsData.wDec}</span>
          </div>
          {#if statsData.winLabel}
            <div class="cs-label cs-win-label">{statsData.winLabel}</div>
          {/if}
        {/if}
        {#if statsData.l > 0}
          <div class="cs-row">
            <span>Losses KO/TKO/Sub/Dec</span>
            <span>{statsData.lKO}/{statsData.lTKO}/{statsData.lSub}/{statsData.lDec}</span>
          </div>
          {#if statsData.lossLabel}
            <div class="cs-label cs-loss-label">{statsData.lossLabel}</div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>

  {#if editOpen}
    <div class="av-overlay" role="presentation" onclick={closeEdit}>
      <div class="av-modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <div class="av-head">
          <h3 class="av-title">Appearance</h3>
          <button class="av-close" aria-label="Close" onclick={closeEdit}>✕</button>
        </div>
        <div class="av-preview">
          <FighterAvatar avatar={cs.avatar} org={pants} {beltType} {beltColor} {gloveColor} size={96} />
        </div>
        {#if locked}
          <p class="av-locked">Already customised this round.</p>
        {/if}
        <div class="av-ctrl">
          <span class="av-label">Hairstyle</span>
          <div class="av-btns">
            {#each HAIR_STYLES as h}
              <button class="av-btn" class:sel={cs.avatar.hairStyle === h} disabled={locked}
                onclick={() => setHair(h)}>{h}</button>
            {/each}
          </div>
        </div>
        <div class="av-ctrl">
          <span class="av-label">Beard</span>
          <div class="av-btns">
            {#each BEARD_STYLES as b}
              <button class="av-btn" class:sel={cs.avatar.beardStyle === b} disabled={locked}
                onclick={() => setBeard(b)}>{b}</button>
            {/each}
          </div>
        </div>
        <div class="av-ctrl">
          <span class="av-label">Pants colour</span>
          <div class="av-btns">
            {#each PANTS_OPTS as opt}
              <button class="av-btn av-pants" class:sel={(cs.avatar.pantsChoice || 'custom') === opt.id} disabled={locked}
                onclick={() => setPants(opt)}>
                <span class="av-swatch" style="background: {opt.main}; border-color: {opt.trim}"></span>{opt.label}
              </button>
            {/each}
          </div>
        </div>
        <button class="av-done" onclick={closeEdit}>Done</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .career-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px 16px; margin-bottom:16px; }
  .cp-header { display:flex; gap:12px; align-items:flex-start; }
  .cp-header-text { flex:1; min-width:0; }
  .cp-avatar { flex-shrink:0; width:72px; height:72px; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
  .cp-avatar-btn { position:relative; padding:0; cursor:pointer; transition:border-color 0.15s; }
  .cp-avatar-btn:hover { border-color:var(--accent); }
  .cp-avatar-edit { position:absolute; right:2px; bottom:1px; font-size:10px; color:var(--accent); background:rgba(0,0,0,0.55); border-radius:3px; padding:0 3px; line-height:1.5; pointer-events:none; }

  /* Appearance popup */
  .av-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; }
  .av-modal { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:18px 20px 20px; max-width:340px; width:100%; }
  .av-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .av-title { font-family:var(--font-display); font-size:20px; letter-spacing:0.04em; color:var(--accent); }
  .av-close { background:none; border:none; color:var(--text-muted); font-size:16px; cursor:pointer; padding:2px 6px; }
  .av-close:hover { color:var(--accent); }
  .av-preview { display:flex; justify-content:center; background:#0c0e16; border:1px solid var(--border); border-radius:var(--radius); padding:10px 0; margin-bottom:14px; }
  .av-preview :global(canvas) { image-rendering:pixelated; }
  .av-ctrl { margin-bottom:12px; }
  .av-label { display:block; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; }
  .av-btns { display:flex; gap:5px; flex-wrap:wrap; }
  .av-btn { font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; background:var(--surface2); border:1px solid var(--border); border-radius:4px; color:var(--text-muted); padding:5px 9px; cursor:pointer; transition:all 0.12s; }
  .av-btn:hover:not(:disabled) { border-color:var(--accent); color:var(--text); }
  .av-btn.sel { border-color:var(--accent); color:var(--accent); background:rgba(232,193,74,0.1); }
  .av-btn:disabled { opacity:0.4; cursor:not-allowed; }
  .av-pants { display:inline-flex; align-items:center; gap:6px; }
  .av-swatch { width:12px; height:12px; border-radius:3px; border:2px solid; flex-shrink:0; }
  .av-locked { font-size:11px; color:var(--amber); text-align:center; margin:-4px 0 12px; }
  .av-done { width:100%; margin-top:6px; background:var(--accent); color:#0d0d0f; border:none; border-radius:var(--radius); font-family:var(--font-display); font-size:15px; letter-spacing:0.05em; padding:9px; cursor:pointer; }
  .cp-fighter { font-family:var(--font-display); font-size:22px; letter-spacing:0.04em; color:var(--text); line-height:1.1; width:100%; word-break:break-word; margin-bottom:3px; }
  .cp-record-line { font-family:var(--font-display); font-size:14px; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:4px; }
  .cp-record-line .r-w { color:var(--green); } .cp-record-line .r-d { color:var(--amber); } .cp-record-line .r-l { color:var(--red); }
  .cp-org-row { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:2px; }
  .cp-promo { font-size:10px; color:var(--text-muted); }
  .cp-rank  { font-size:11px; font-weight:600; }
  .rank-unranked { color:var(--text-muted); } .rank-ranked { color:var(--accent); } .rank-champion { color:var(--accent); font-size:12px; }
  .cp-divider { height:1px; background:var(--border); margin:8px 0; }
  .st-champ      { background:rgba(232,193,74,0.18); color:var(--accent); border:1px solid rgba(232,193,74,0.4); }
  .st-former     { background:rgba(232,193,74,0.06); color:var(--text-muted); border:1px solid rgba(232,193,74,0.18); }
  .st-defense    { background:rgba(232,193,74,0.10); color:var(--accent); }
  .cp-streaks-wrap { display:flex; flex-wrap:wrap; gap:4px; }
  .streak-tag { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:600; padding:2px 7px; border-radius:3px; }
  .st-win        { background:rgba(74,232,122,0.12);  color:var(--green); }
  .st-loss       { background:rgba(232,74,74,0.12);   color:var(--red); }
  .st-finish     { background:rgba(232,193,74,0.12);  color:var(--amber); }
  .st-unbeaten   { background:rgba(160,232,255,0.10); color:#a0e8ff; }
  .st-undefeated { background:rgba(180,74,232,0.15);  color:#d088ff; border:1px solid rgba(180,74,232,0.3); }
  .cp-last-row   { display:flex; align-items:center; gap:10px; }
  .cp-last-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); }
  .cp-last { display:flex; gap:4px; }
  .cp-pip  { width:9px; height:9px; border-radius:2px; }
  .cp-pip.w { background:var(--green); } .cp-pip.d { background:var(--amber); } .cp-pip.l { background:var(--red); } .cp-pip.f { background:#a0001a; } .cp-pip.empty { background:rgba(255,255,255,0.08); }
  .cp-stats { font-size:11px; line-height:1.8; color:var(--text-muted); }
  .cs-row   { display:flex; justify-content:space-between; }
  .cs-label { font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:2px 8px; border-radius:3px; margin-top:4px; }
  .cs-win-label  { background:var(--green-dim); color:var(--green); }
  .cs-loss-label { background:var(--red-dim);   color:var(--red); }
  .durability-wrap { margin-bottom:8px; }
  .durability-row  { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .durability-label { font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-muted); }
  .durability-value { font-family:var(--font-display); font-size:13px; letter-spacing:0.04em; }
  .durability-bar-bg { height:4px; background:rgba(255,255,255,0.07); border-radius:3px; overflow:hidden; }
  .durability-bar    { height:100%; border-radius:3px; transition:width 0.6s ease,background 0.4s; }
  .cp-retire-btn { font-size:10px; letter-spacing:0.08em; text-transform:uppercase; background:transparent; border:1px solid rgba(255,255,255,0.12); border-radius:3px; color:var(--text-muted); padding:3px 9px; cursor:pointer; font-family:var(--font-body); transition:border-color 0.15s,color 0.15s; flex-shrink:0; }
  .cp-retire-btn:hover { border-color:var(--red); color:var(--red); }
</style>
