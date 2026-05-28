<!-- src/lib/mma/screens/CareerPanel.svelte -->
<!-- Stats only: name, record, rank, durability, champ, streaks, last 3, win/loss stats -->
<script>
  import { state as gs } from '$lib/mma/state.svelte.js';
  import {
    getPhaseDef, getPlayerSlot, slotToRankLabel, slotToCssClass, isUndefeated,
  } from '$lib/mma/career.js';
  import { CHAMP_SLOT } from '$lib/mma/constants.js';

  const cs      = $derived(gs.career);
  const pDef    = $derived(cs ? getPhaseDef(cs) : null);
  const slot    = $derived(cs ? getPlayerSlot(cs) : 0);
  const isChamp = $derived(slot === CHAMP_SLOT && !!cs?.titleHeld);

  const rankText = $derived(
    !cs || !pDef ? '' :
    isChamp ? '🏆 ' + (cs.titleName || 'Champion') :
    slotToRankLabel(slot, pDef)
  );
  const rankClass = $derived(
    !cs ? '' : isChamp ? 'rank-champion' : slotToCssClass(slot)
  );
  const champText = $derived(
    !cs || (!cs.titleHeld && !cs.champCount) ? null :
    cs.titleHeld
      ? (cs.champCount > 1 ? `${cs.champCount}-Time ` : '') +
        (cs.titleName || 'Champion') +
        (cs.defenseStreak > 0
          ? ` · ${cs.defenseStreak} defense${cs.defenseStreak > 1 ? 's' : ''}`
          : ' · Undefeated champion')
      : `${cs.champCount}-Time former champion`
  );

  const ws  = $derived(Math.max(0, gs.currentStreak || 0));
  const ls  = $derived(Math.abs(Math.min(0, gs.currentStreak || 0)));
  const fs  = $derived(gs.finishStreak || 0);
  const ub  = $derived(gs.unbeatenStreak || 0);
  const und = $derived(cs ? isUndefeated(gs) : false);

  const streakTags = $derived((() => {
    const tags = [];
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
      const wMax = Math.max(wKO, wTKO, wSub, wDec);
      const tied = [wKO, wTKO, wSub, wDec].filter(v => v === wMax).length > 1;
      if (tied || wMax === 0)  winLabel = 'Allrounder';
      else if (wKO === wMax)   winLabel = 'KO Artist';
      else if (wTKO === wMax)  winLabel = 'Pressure Fighter';
      else if (wSub === wMax)  winLabel = 'Submission Artist';
      else                     winLabel = 'Decision Merchant';
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
    gs.screen = 'end';
  }
</script>

{#if cs}
  <div class="career-panel">
    <div class="cp-fighter">{cs.fighterName}{cs.titleHeld ? ' 🏆' : ''}</div>
    <div class="cp-record-line">
      <span class="r-w">{gs.wins}</span>W&nbsp;–&nbsp;<span class="r-d">{gs.draws}</span>D&nbsp;–&nbsp;<span class="r-l">{gs.losses}</span>L
    </div>
    <div class="cp-org-row">
      <span class="cp-promo">{pDef?.promo}</span>
      <span class="cp-rank {rankClass}">{rankText}</span>
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

    {#if champText}
      <div class="cp-divider"></div>
      <div class="cp-title">{champText}</div>
    {/if}

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
{/if}

<style>
  .career-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px 16px; margin-bottom:16px; }
  .cp-fighter { font-family:var(--font-display); font-size:22px; letter-spacing:0.04em; color:var(--text); line-height:1.1; width:100%; word-break:break-word; margin-bottom:3px; }
  .cp-record-line { font-family:var(--font-display); font-size:14px; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:4px; }
  .cp-record-line .r-w { color:var(--green); } .cp-record-line .r-d { color:var(--amber); } .cp-record-line .r-l { color:var(--red); }
  .cp-org-row { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:2px; }
  .cp-promo { font-size:10px; color:var(--text-muted); }
  .cp-rank  { font-size:11px; font-weight:600; }
  .rank-unranked { color:var(--text-muted); } .rank-ranked { color:var(--accent); } .rank-champion { color:var(--accent); font-size:12px; }
  .cp-divider { height:1px; background:var(--border); margin:8px 0; }
  .cp-title { font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--accent); line-height:1.5; }
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
