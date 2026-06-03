<!-- src/lib/football/screens/HubScreen.svelte -->
<script>
  import { get }      from 'svelte/store';
  import { session }  from '$lib/stores/session.js';
  import { supabase } from '$lib/supabase.js';
  import { fetchSet } from '$lib/questions.js';
  import { loadGroups } from '$lib/progress.js';
  import { state as gs }             from '$lib/football/state.svelte.js';
  import { sortTable, getTableRow, getClubName } from '$lib/football/league.js';
  import { calcTeamRating, assignStatuses }       from '$lib/football/squad.js';
  import { ordinal, divName }                     from '$lib/football/utils.js';
  import { relegationCount, DIFF_LABELS, DIFF_COLORS, DIFF_BG, TIER_ORDER } from '$lib/football/constants.js';

  const { onplaymatch, onsave, onmenu, onsaveandquit, saving = false, saveError = null, onswitchmodule } = $props();

  let activeTab  = $state('table');
  let swapSrcId  = $state(null);
  let squadSortCol = $state('status');
  let squadSortDir = $state(1);

  // ── Derived table data ────────────────────────────────
  const divTable  = $derived(sortTable(gs.table?.[`div${gs.division}`] || []));
  const divTotal  = $derived(divTable.length);
  const playerPos = $derived(divTable.findIndex(r => r.id === 'player') + 1);
  const relCount  = $derived(relegationCount(divTotal));

  const playerMatch = $derived(
    gs.fixtures?.[`div${gs.division}`]?.[gs.matchday - 1]?.matches
      ?.find(m => m.homeId === 'player' || m.awayId === 'player') || null
  );
  const matchPlayed = $derived(playerMatch?.played === true);

  // ── Position colour ───────────────────────────────────
  function posColor(pos, total, div) {
    const rel = relegationCount(total);
    if (pos > total - rel) return 'var(--red)';
    if (div === 2 && pos <= rel) return 'var(--green)';
    if (div === 1) {
      if (pos === 1) return 'var(--gold)';
      const clEnd   = total <= 8 ? 2 : total <= 14 ? 3 : 4;
      const euroEnd = total <= 8 ? 3 : total <= 14 ? 5 : 6;
      if (pos <= clEnd)   return 'var(--purple)';
      if (pos <= euroEnd) return '#5ab0e0';
    }
    return null;
  }

  // ── Kit bar ───────────────────────────────────────────
  function kitBar(row) {
    if (!row) return '';
    if (row.id === 'player') {
      const col = gs.club?.kitColour || '#888';
      return `<span class="kit-bar"><span style="background:${col};flex:1;height:100%"></span></span>`;
    }
    const colours = row.colours || [];
    if (!colours.length) return '';
    const segs = colours.map(c => `<span style="background:${c};flex:1;height:100%"></span>`).join('');
    return `<span class="kit-bar">${segs}</span>`;
  }

  // ── Form dots ─────────────────────────────────────────
  function formDots(form) {
    return (form || []).slice(-5).map(r =>
      `<span class="form-dot ${r==='W'?'fw':r==='D'?'fd':'fl'}"></span>`
    ).join('');
  }

  // ── Squad sort ────────────────────────────────────────
  function sortSquad(col) {
    if (squadSortCol === col) squadSortDir *= -1;
    else { squadSortCol = col; squadSortDir = ['name','position'].includes(col) ? 1 : -1; }
  }

  const sortedSquad = $derived.by(() => {
    const col = squadSortCol;
    const dir = squadSortDir;
    return [...gs.squad].sort((a, b) => {
      if (col === 'status')   return dir * ((a.status==='Starter'?0:1) - (b.status==='Starter'?0:1) || b.rating - a.rating);
      if (col === 'position') return dir * (a.position.localeCompare(b.position) || b.rating - a.rating);
      if (col === 'rating')   return dir * (b.rating - a.rating);
      if (col === 'age')      return dir * (a.age - b.age);
      if (col === 'goals')    return dir * (b.goalsThisSeason - a.goalsThisSeason);
      if (col === 'name')     return dir * a.name.localeCompare(b.name);
      return 0;
    });
  });

  // ── Squad swap ────────────────────────────────────────
  function squadSwapClick(pid) {
    if (swapSrcId === null) {
      swapSrcId = pid;
    } else if (swapSrcId === pid) {
      swapSrcId = null;
    } else {
      const src = gs.squad.find(p => p.id === swapSrcId);
      const tgt = gs.squad.find(p => p.id === pid);
      swapSrcId = null;
      if (!src || !tgt) return;
      if (src.position !== tgt.position) return;
      if (src.status === tgt.status)     return;
      [src.status, tgt.status] = [tgt.status, src.status];
      gs.club.rating = calcTeamRating(gs.squad);
      const plRow = getTableRow('player', gs.table.div1, gs.table.div2);
      if (plRow) plRow.rating = gs.club.rating;
      onsave?.();
    }
  }

  function canSwap(pid) {
    if (swapSrcId === null) return false;
    const src = gs.squad.find(p => p.id === swapSrcId);
    const tgt = gs.squad.find(p => p.id === pid);
    return src && tgt && src.position === tgt.position && src.status !== tgt.status;
  }

  // ── Tactic ────────────────────────────────────────────
  function setTactic(t) {
    gs.tactic = t;
    onsave?.();
  }

  // ── Module helpers ────────────────────────────────────
  function totalQs(mod) {
    return TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t] || []).length, 0);
  }
  function countTiers(mod) {
    return TIER_ORDER.filter(t => (mod.tiers?.[t] || []).length > 0);
  }
  function modTagLabel(mod) {
    if (mod?.tag === 'library') return 'Library';
    if (mod?.tag === 'public')  return 'Public';
    if (mod?.tag === 'group')   return 'Group';
    return 'Default';
  }
  function modTagClass(mod) {
    if (mod?.tag === 'library') return 'tag-library';
    if (mod?.tag === 'public')  return 'tag-public';
    if (mod?.tag === 'group')   return 'tag-group';
    return 'tag-default';
  }

  const bundledSets       = $derived(gs.availableModules.filter(m => !m.tag));
  const activeModNonDefault = $derived(
    gs.activeModId !== null &&
    !bundledSets.find(m => m.id === gs.activeModId)
  );

  function selectModule(modId) {
    if (!modId || gs.activeModId === modId) return;
    onswitchmodule?.(modId);
  }

  // ── Browse modal ──────────────────────────────────────
  let browseOpen   = $state(false);
  let browseTab    = $state('public');
  let browsePicked = $state(null);
  let libItems     = $state([]);
  let libGroups    = $state([]);
  let libLoading   = $state(false);
  let libError     = $state('');
  let building     = $state(false);

  const publicSets = $derived(gs.availableModules.filter(m => !m.tag || m.tag === 'public'));

  async function openBrowse(tab = 'public') {
    browseTab = tab; browsePicked = null; browseOpen = true;
    if (tab === 'library') await loadLibrary();
  }

  async function loadLibrary() {
    let sess = get(session);
    if (!sess) {
      const { data } = await supabase.auth.getSession();
      sess = data?.session || null;
    }
    if (!sess) { libError = 'Log in to access your library.'; return; }
    libLoading = true; libError = ''; libItems = []; libGroups = [];
    try {
      const [setsRes, groupsRes] = await Promise.all([
        supabase.from('user_question_sets')
          .select('id, name, description, question_count, data, starred')
          .eq('user_id', sess.user.id)
          .order('created_at', { ascending: false }),
        loadGroups(sess.user.id),
      ]);
      if (setsRes.error) throw setsRes.error;
      const byStar = (a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      libItems  = (setsRes.data || []).sort(byStar);
      libGroups = (groupsRes || []).filter(g => (g.question_set_group_members || []).length > 0).sort(byStar);
    } catch(e) {
      libError = '⚠ Could not load library: ' + e.message;
    } finally {
      libLoading = false;
    }
  }

  async function buildGroupModule(group) {
    const members = group.question_set_group_members || [];
    const merged  = {};
    for (const m of members) {
      let data = null;
      if (m.set_source === 'library') {
        const { data: row } = await supabase.from('user_question_sets').select('data').eq('id', m.set_id).maybeSingle();
        data = row?.data;
      } else if (m.set_source === 'public') {
        try { data = await fetchSet(m.set_id.endsWith('.json') ? m.set_id : m.set_id + '.json'); } catch { /* skip */ }
      } else {
        data = gs.loadedModules?.[m.set_id] || gs.loadedModules?.[m.set_id?.replace('.json', '')];
        if (!data) { try { data = await fetchSet(m.set_id); } catch { /* skip */ } }
      }
      if (!data?.tiers) continue;
      for (const t of TIER_ORDER) {
        const qs = data.tiers[t] || [];
        if (!qs.length) continue;
        (merged[t] ||= []).push(...qs);
      }
    }
    return { id: 'grp_' + group.id, tag: 'group', name: group.name,
             description: `${members.length} set${members.length !== 1 ? 's' : ''}`, tiers: merged };
  }

  async function switchBrowseTab(tab) {
    browseTab = tab; browsePicked = null;
    if (tab === 'library' && !libItems.length && !libGroups.length && !libError) await loadLibrary();
  }

  async function confirmBrowsePick() {
    if (!browsePicked) return;
    let pickedId;
    if (browsePicked.source === 'group') {
      building = true; libError = '';
      try {
        const mod = await buildGroupModule(browsePicked.group);
        const total = TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t] || []).length, 0);
        if (total === 0) { libError = 'This group has no questions yet.'; return; }
        if (!gs.loadedModules[mod.id]) gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[mod.id] = mod;
        pickedId = mod.id;
      } catch (e) {
        libError = '⚠ Could not build group: ' + e.message; return;
      } finally { building = false; }
    } else if (browsePicked.source === 'public') {
      const mod = browsePicked.mod;
      if (!gs.loadedModules[mod.id]) { gs.availableModules = [...gs.availableModules, mod]; gs.loadedModules[mod.id] = mod; }
      pickedId = mod.id;
    } else {
      const item = browsePicked.item;
      const id   = 'lib_' + item.id;
      if (!gs.loadedModules[id]) {
        const mod = { id, tag: 'library', name: item.name, description: item.description ?? '', ...item.data };
        gs.availableModules = [...gs.availableModules, mod];
        gs.loadedModules[id] = mod;
      }
      pickedId = id;
    }
    selectModule(pickedId);
    browseOpen = false; browsePicked = null;
  }

  function closeBrowse() { browseOpen = false; browsePicked = null; }

  // ── Question score stats ──────────────────────────────
  const promoted = $derived(Object.values(gs._qScores || {}).filter(s => s >= 3).length);
  const demoted  = $derived(Object.values(gs._qScores || {}).filter(s => s <= -3).length);

  function confirmNewGame() {
    if (confirm('Abandon this save and return to the main menu?')) onmenu?.();
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && browseOpen) closeBrowse();
  }

  // ── HTML helpers (rendered with {@html}) ──────────────
  function posBadge(pos) {
    const cls = pos === 'GK' ? 'pos-gk' : pos === 'DEF' ? 'pos-def' : pos === 'MID' ? 'pos-mid' : 'pos-fwd';
    return `<span class="pos-badge ${cls}">${pos}</span>`;
  }
  function ratingBar(p) {
    const pct = Math.max(0, (p.rating - 40) / 52 * 100);
    return `<span class="rating-bar-wrap"><span class="rating-bar-track"><span class="rating-bar-fill" style="width:${pct}%"></span></span><span class="rating-num">${p.rating}</span></span>`;
  }
  function statusBadge(p) {
    const cls = p.status === 'Starter' ? 'status-starter' : 'status-rotation';
    return `<span class="status-badge ${cls}">${p.status}</span>`;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="hub-layout">
  <!-- ── Header ────────────────────────────────────────── -->
  <header class="hub-header">
    <div class="hub-title">
      {@html kitBar(getTableRow('player', gs.table?.div1||[], gs.table?.div2||[]))}
      {gs.club?.name}
    </div>
    <div class="hub-meta">
      <span class="hub-season">{divName(gs.division)} · Season {gs.season}</span>
      <span class="hub-rating">Rtg {gs.club?.rating}</span>
    </div>
  </header>

  <!-- ── Tabs ──────────────────────────────────────────── -->
  <nav class="hub-tabs">
    {#each [['table','Table'],['fixtures','Fixtures'],['squad','Squad'],['info','Info'],['questions','Questions']] as [id, label]}
      <button class="hub-tab" class:active={activeTab === id} onclick={() => activeTab = id}>{label}</button>
    {/each}
  </nav>

  <!-- ── Body ──────────────────────────────────────────── -->
  <div class="hub-body">

    <!-- ══ TABLE TAB ══════════════════════════════════════ -->
    {#if activeTab === 'table'}
      <p class="section-label">{divName(gs.division)} · Matchday {gs.matchday - 1} played</p>
      <table class="league-table">
        <thead>
          <tr>
            <th class="pos">#</th>
            <th>Club</th>
            <th class="num">P</th>
            <th class="num">W</th>
            <th class="num">D</th>
            <th class="num">L</th>
            <th class="num">GF</th>
            <th class="num">GA</th>
            <th class="num">GD</th>
            <th class="num">Pts</th>
            <th class="num">Form</th>
          </tr>
        </thead>
        <tbody>
          {#each divTable as row, i}
            {@const pos   = i + 1}
            {@const gd    = row.gf - row.ga}
            {@const pCol  = posColor(pos, divTotal, gs.division)}
            {@const isRel = pos > divTotal - relCount}
            {@const isPro = gs.division === 2 && pos <= relCount}
            <tr
              class:player-row={row.id === 'player'}
              class:rel-zone={isRel}
              class:pro-zone={isPro && pos === relCount}
            >
              <td class="pos" style={pCol ? `color:${pCol}` : ''}>{pos}</td>
              <td class="club-name">
                {@html kitBar(row)}
                {row.name}
              </td>
              <td class="num">{row.pld}</td>
              <td class="num">{row.w}</td>
              <td class="num">{row.d}</td>
              <td class="num">{row.l}</td>
              <td class="num">{row.gf}</td>
              <td class="num">{row.ga}</td>
              <td class="num" class:gd-pos={gd>0} class:gd-neg={gd<0}>{gd>0?'+':''}{gd}</td>
              <td class="num pts">{row.pts}</td>
              <td class="num">{@html formDots(row.form)}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <!-- Legend -->
      <div class="legend">
        {#if gs.division === 2}
          <span class="legend-dot" style="background:var(--green)"></span> Promotion
        {:else}
          <span class="legend-dot" style="background:var(--gold)"></span> Champions ·
          <span class="legend-dot" style="background:var(--purple)"></span> European
        {/if}
        <span class="legend-dot" style="background:var(--red)"></span> Relegation
      </div>

    <!-- ══ FIXTURES TAB ═══════════════════════════════════ -->
    {:else if activeTab === 'fixtures'}
      {#each gs.fixtures?.[`div${gs.division}`] || [] as md}
        {@const isCurrent = md.matchday === gs.matchday}
        <div class="matchday-block">
          <div class="matchday-heading" class:current={isCurrent}>
            Matchday {md.matchday}
          </div>
          {#each md.matches as m}
            {@const isPlayerMatch = m.homeId === 'player' || m.awayId === 'player'}
            {@const homeName = m.homeId === 'player' ? gs.club.name : getClubName(m.homeId, gs.table.div1, gs.table.div2)}
            {@const awayName = m.awayId === 'player' ? gs.club.name : getClubName(m.awayId, gs.table.div1, gs.table.div2)}
            <div class="fixture-row" class:player-fixture={isPlayerMatch} class:played={m.played}>
              <span class="fixture-home" class:bold={isPlayerMatch && m.homeId === 'player'}>{homeName}</span>
              {#if m.played}
                <span class="fixture-score">
                  <span class:rw={m.homeId==='player'&&m.hg>m.ag||m.awayId==='player'&&m.ag>m.hg}
                        class:rl={m.homeId==='player'&&m.hg<m.ag||m.awayId==='player'&&m.ag<m.hg}
                        class:rd={m.hg===m.ag}>
                    {m.hg} – {m.ag}
                  </span>
                </span>
              {:else}
                <span class="fixture-score upcoming">vs</span>
              {/if}
              <span class="fixture-away" class:bold={isPlayerMatch && m.awayId === 'player'}>{awayName}</span>
            </div>
          {/each}
        </div>
      {/each}

    <!-- ══ SQUAD TAB ══════════════════════════════════════ -->
    {:else if activeTab === 'squad'}
      <!-- Team rating bar -->
      <div class="team-rating-bar">
        <span class="section-label" style="margin:0">Team Rating</span>
        <div class="rating-bar-track" style="flex:1;height:6px;background:var(--surface3);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:{Math.max(0,(gs.club?.rating-40)/52*100)}%;background:var(--gold);border-radius:3px"></div>
        </div>
        <span style="font-family:var(--font-display);font-size:22px;color:var(--gold)">{gs.club?.rating}</span>
      </div>

      <!-- Tactic -->
      <div class="tactic-row mb-16">
        <span class="section-label" style="margin:0">Tactic</span>
        <div class="tactic-btns">
          {#each [['defensive','Defensive','↓ Qs, defensive bonus'],['moderate','Moderate','Balanced'],['offensive','Offensive','↑ Qs, extra firepower']] as [t, label, desc]}
            <button class="tactic-btn" class:active={gs.tactic === t} onclick={() => setTactic(t)} title={desc}>
              {label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Swap hint -->
      {#if swapSrcId}
        <div class="swap-hint">Select a {gs.squad.find(p=>p.id===swapSrcId)?.position} to swap — or click the same player to cancel</div>
      {:else}
        <div class="swap-hint muted">Click a player's ⇄ to swap Starter / Rotation within the same position</div>
      {/if}

      <!-- Squad table -->
      <table class="squad-table">
        <thead>
          <tr>
            <th onclick={() => sortSquad('name')} class:sorted={squadSortCol==='name'}>Player</th>
            <th onclick={() => sortSquad('position')} class:sorted={squadSortCol==='position'}>Pos</th>
            <th class="num" onclick={() => sortSquad('rating')} class:sorted={squadSortCol==='rating'}>Rtg</th>
            <th class="num" onclick={() => sortSquad('age')} class:sorted={squadSortCol==='age'}>Age</th>
            <th class="num" onclick={() => sortSquad('goals')} class:sorted={squadSortCol==='goals'}>⚽</th>
            <th>Status</th>
            <th style="width:36px"></th>
          </tr>
        </thead>
        <tbody>
          {#each sortedSquad as p (p.id)}
            {@const swappable = canSwap(p.id)}
            {@const swapActive = swapSrcId === p.id}
            {@const inactive   = swapSrcId !== null && !swappable && !swapActive}
            <tr
              class:starter={p.status === 'Starter'}
              class:rotation={p.status === 'Rotation'}
              class:swap-target={swappable}
              class:swap-inactive={inactive}
              onclick={() => { if (swappable) squadSwapClick(p.id); }}
            >
              <td class="player-name">{p.name}</td>
              <td>{@html posBadge(p.position)}</td>
              <td class="num">{@html ratingBar(p)}</td>
              <td class="num">{p.age}</td>
              <td class="num">{p.goalsThisSeason}</td>
              <td>{@html statusBadge(p)}</td>
              <td style="width:36px;text-align:center;padding:0">
                <button
                  class="swap-handle"
                  class:swap-active={swapActive}
                  onclick={(e) => { e.stopPropagation(); squadSwapClick(p.id); }}
                  title="Swap starter/rotation"
                  disabled={p.position === 'GK' && gs.squad.filter(s=>s.position==='GK').length < 2}
                >⇄</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

    <!-- ══ QUESTIONS TAB ════════════════════════════════════ -->
    {:else if activeTab === 'questions'}
      <div class="section-label">Question Set</div>
      <div class="qset-grid">
        {#each bundledSets as mod (mod.id)}
          <button class="qset-card" class:selected={gs.activeModId === mod.id}
            onclick={() => selectModule(mod.id)}>
            <div class="qset-card-name">{mod.name}</div>
            <div class="qset-card-desc">{mod.description ?? ''}</div>
            <div class="qset-stats">
              {#each countTiers(mod) as t}
                <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">
                  {DIFF_LABELS[t]} ×{mod.tiers[t].length}
                </span>
              {/each}
              <span class="qset-total">{totalQs(mod)} q</span>
            </div>
          </button>
        {/each}
      </div>

      <!-- Active non-default set -->
      {#if activeModNonDefault}
        {@const mod = gs.loadedModules?.[gs.activeModId]}
        {#if mod}
          <button class="qset-card qset-card-full selected" onclick={() => {}}>
            <div class="qset-card-top">
              <span class="module-tag {modTagClass(mod)}">{modTagLabel(mod)}</span>
              <span class="qset-clear" role="button" tabindex="0"
                onclick={(e) => { e.stopPropagation(); selectModule(bundledSets[0]?.id); }}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); selectModule(bundledSets[0]?.id); } }}>✕</span>
            </div>
            <div class="qset-card-name">{mod.name}</div>
            <div class="qset-card-desc">{mod.description ?? ''}</div>
            <div class="qset-stats">
              {#each countTiers(mod) as t}
                <span class="tier-badge" style="background:{DIFF_BG[t]};color:{DIFF_COLORS[t]}">
                  {DIFF_LABELS[t]} ×{mod.tiers[t].length}
                </span>
              {/each}
              <span class="qset-total">{totalQs(mod)} questions</span>
            </div>
          </button>
        {/if}
      {/if}

      <div class="browse-row">
        <button class="browse-btn" onclick={() => openBrowse('public')}>
          <span class="browse-btn-text"><strong>Public Sets</strong><span>Community question sets</span></span>
          <span style="color:var(--muted)">→</span>
        </button>
        <button class="browse-btn" onclick={() => openBrowse('library')}>
          <span class="browse-btn-text"><strong>My Library</strong><span>Your saved sets</span></span>
          <span style="color:var(--muted)">→</span>
        </button>
      </div>

      {#if promoted || demoted}
        <div class="qscore-stats" style="margin-top:14px">
          {#if promoted}<span style="color:var(--green)">▲ {promoted} promoted</span>{/if}
          {#if demoted}<span style="color:var(--red)">▼ {demoted} demoted</span>{/if}
        </div>
      {/if}

    <!-- ══ INFO TAB ════════════════════════════════════════ -->
    {:else if activeTab === 'info'}
      <p class="section-label">Career</p>
      <div class="card mb-16">
        <div class="stat-grid">
          <div class="stat-cell">
            <div class="stat-label">Seasons</div>
            <div class="stat-val">{gs.career?.seasonsPlayed || 0}</div>
          </div>
          <div class="stat-cell">
            <div class="stat-label">Championships</div>
            <div class="stat-val">{gs.career?.championships || 0}</div>
          </div>
          <div class="stat-cell">
            <div class="stat-label">Best Div 1 Finish</div>
            <div class="stat-val">{gs.career?.highestDiv1Finish ? ordinal(gs.career.highestDiv1Finish) : '—'}</div>
          </div>
          <div class="stat-cell">
            <div class="stat-label">Record</div>
            <div class="stat-val record">
              <span style="color:var(--green)">{gs.career?.wins||0}</span>
              <span style="color:var(--muted)"> – </span>
              <span style="color:var(--gold)">{gs.career?.draws||0}</span>
              <span style="color:var(--muted)"> – </span>
              <span style="color:var(--red)">{gs.career?.losses||0}</span>
            </div>
          </div>
          <div class="stat-cell">
            <div class="stat-label">Total Goals</div>
            <div class="stat-val">{gs.career?.totalGoals || 0}</div>
          </div>
          <div class="stat-cell">
            <div class="stat-label">Division</div>
            <div class="stat-val">{divName(gs.division)}</div>
          </div>
        </div>
      </div>

      <p class="section-label">Danger Zone</p>
      <button class="btn btn-danger btn-sm" onclick={confirmNewGame}>Abandon Save & New Game</button>
    {/if}
  </div>

  <!-- ── Browse modal (Questions tab) ──────────────────── -->
  {#if browseOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="lib-overlay" onclick={closeBrowse}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="lib-modal" onclick={e => e.stopPropagation()}>
        <div class="lib-header">
          <div class="lib-tabs">
            <button class="lib-tab" class:active={browseTab === 'public'} onclick={() => switchBrowseTab('public')}>Public</button>
            <button class="lib-tab" class:active={browseTab === 'library'} onclick={() => switchBrowseTab('library')}>Library</button>
          </div>
          <button class="lib-close" onclick={closeBrowse}>✕</button>
        </div>

        {#if browseTab === 'public'}
          {#if publicSets.length === 0}
            <div class="lib-empty">No public sets available.</div>
          {:else}
            <div class="lib-list">
              {#each publicSets as mod (mod.id)}
                <button class="lib-item"
                  class:selected={browsePicked?.mod?.id === mod.id}
                  onclick={() => browsePicked = { source: 'public', mod }}>
                  <div class="lib-item-name">
                    {mod.name}
                    {#if !mod.tag}<span class="default-tag">Default</span>{/if}
                    {#if mod.id === gs.activeModId}<span class="active-tag-sm">Active</span>{/if}
                  </div>
                  <div class="lib-item-meta">{mod.description ?? ''} · {totalQs(mod)} questions</div>
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          {#if libLoading}
            <div class="lib-empty">Loading…</div>
          {:else if libError}
            <div class="lib-empty" style="color:var(--red)">{libError}</div>
            {#if !get(session)}
              <div style="text-align:center;padding:0 20px 16px"><a href="/auth/login" class="lib-login">Log In →</a></div>
            {/if}
          {:else if libItems.length === 0 && libGroups.length === 0}
            <div class="lib-empty">
              No sets in your library yet.
              <div><a href="/questions/library" target="_blank" class="lib-login">Go to My Library →</a></div>
            </div>
          {:else}
            <div class="lib-list">
              {#if libGroups.length > 0}
                <div class="lib-sublabel">Groups</div>
                {#each libGroups as group (group.id)}
                  {@const memberCount = (group.question_set_group_members || []).length}
                  <button class="lib-item lib-group-item"
                    style="--gc:{group.color || '#d4a847'}"
                    class:selected={browsePicked?.source === 'group' && browsePicked?.group?.id === group.id}
                    onclick={() => browsePicked = { source: 'group', group }}>
                    <div class="lib-item-name">
                      {#if group.starred}<span class="star-ind">★</span>{/if}
                      <span class="lib-group-dot" style="background:{group.color || '#d4a847'}"></span>{group.name}
                      <span class="group-tag">Group</span>
                    </div>
                    <div class="lib-item-meta">Plays every set in this group · {memberCount} set{memberCount !== 1 ? 's' : ''}</div>
                  </button>
                {/each}
                <div class="lib-sublabel">Individual Sets</div>
              {/if}
              {#each libItems as item (item.id)}
                <button class="lib-item"
                  class:selected={browsePicked?.source === 'library' && browsePicked?.item?.id === item.id}
                  onclick={() => browsePicked = { source: 'library', item }}>
                  <div class="lib-item-name">{#if item.starred}<span class="star-ind">★</span>{/if}{item.name}</div>
                  <div class="lib-item-meta">{item.description ?? ''}{item.question_count ? ` · ${item.question_count} questions` : ''}</div>
                </button>
              {/each}
            </div>
          {/if}
        {/if}

        <div class="lib-footer">
          <button class="btn btn-primary" disabled={!browsePicked || building} onclick={confirmBrowsePick}>
            {building ? 'Building…' : browsePicked?.source === 'group' ? 'Use This Group' : 'Use This Set'}
          </button>
          <button class="btn btn-ghost" onclick={closeBrowse}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ── Footer ─────────────────────────────────────────── -->
  <footer class="hub-footer">
    <div class="footer-left">
      <div style="font-size:12px;color:var(--muted)">
        Matchday <strong style="color:var(--text)">{gs.matchday}</strong> of {gs.matchdays}
        {#if playerPos}· <strong style="color:var(--text)">{ordinal(playerPos)}</strong> place{/if}
      </div>
      {#if saveError}
        <div class="save-error">{saveError}</div>
      {/if}
    </div>
    <div class="footer-btns">
      <button class="btn btn-save-exit" onclick={onsaveandquit} disabled={saving}>
        {saving ? 'Saving…' : 'Save & Exit'}
      </button>
      <button class="btn btn-primary" onclick={onplaymatch} disabled={matchPlayed}>
        {matchPlayed ? 'Match Played' : `▶ Matchday ${gs.matchday}`}
      </button>
    </div>
  </footer>
</div>

<style>
  /* ── Layout ──────────────────────────────────────────── */
  .hub-layout { display: flex; flex-direction: column; height: calc(100vh - 44px); overflow: hidden; }

  .hub-header {
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    flex-shrink: 0;
  }
  .hub-title {
    font-family: var(--font-display); font-size: 22px; color: var(--gold); letter-spacing: .04em;
    display: flex; align-items: center; gap: 8px;
  }
  .hub-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .hub-season { font-size: 12px; color: var(--text-dim); }
  .hub-rating { font-family: var(--font-display); font-size: 18px; color: var(--text); }

  .hub-tabs {
    display: flex; background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 0 24px; flex-shrink: 0;
  }
  .hub-tab {
    padding: 10px 18px; font-size: 12px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--muted);
    border: none; border-bottom: 2px solid transparent; background: none; cursor: pointer;
    transition: color .15s, border-color .15s; margin-bottom: -1px;
  }
  .hub-tab:hover { color: var(--text); }
  .hub-tab.active { color: var(--gold); border-bottom-color: var(--gold); }

  .hub-body { flex: 1; padding: 20px 24px; overflow-y: auto; max-width: 900px; width: 100%; margin: 0 auto; }

  .hub-footer {
    background: var(--surface); border-top: 1px solid var(--border);
    padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    flex-shrink: 0; position: sticky; bottom: 0;
  }
  .footer-left  { display: flex; flex-direction: column; gap: 4px; }
  .footer-btns  { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .save-error   { font-size: 11px; color: var(--red); }
  .btn-save-exit {
    background: var(--surface2); color: var(--text-dim);
    border: 1px solid var(--border); border-radius: 3px;
    font-family: var(--font-body); font-size: 13px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
    padding: 10px 20px; transition: border-color .15s, color .15s;
    display: inline-flex; align-items: center; white-space: nowrap;
  }
  .btn-save-exit:hover:not(:disabled) { border-color: var(--gold-dim); color: var(--text); }
  .btn-save-exit:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Shared ──────────────────────────────────────────── */
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; display: block; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 16px 20px; }
  .mb-16 { margin-bottom: 16px; }

  /* ── Kit bar ─────────────────────────────────────────── */
  :global(.kit-bar) { display: inline-flex; width: 18px; height: 14px; border-radius: 2px; overflow: hidden; vertical-align: middle; flex-shrink: 0; }

  /* ── Form dots ───────────────────────────────────────── */
  :global(.form-dot) { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin: 0 1px; vertical-align: middle; }
  :global(.form-dot.fw) { background: var(--green); }
  :global(.form-dot.fd) { background: var(--amber); }
  :global(.form-dot.fl) { background: var(--red); }

  /* ── League table ────────────────────────────────────── */
  .league-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
  .league-table th { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); padding: 8px 8px; text-align: left; border-bottom: 1px solid var(--border); cursor: default; }
  .league-table th.num { text-align: right; }
  .league-table td { padding: 8px 8px; border-bottom: 1px solid var(--surface2); font-variant-numeric: tabular-nums; }
  .league-table td.num { text-align: right; color: var(--text-dim); }
  .league-table tr:last-child td { border-bottom: none; }
  .league-table .pos { width: 24px; font-weight: 600; }
  .league-table .club-name { font-weight: 500; display: flex; align-items: center; gap: 7px; }
  .league-table .pts { color: var(--text); font-weight: 600; }
  .league-table .gd-pos { color: var(--green); }
  .league-table .gd-neg { color: var(--red); }
  .league-table tr.player-row td { color: var(--gold); background: rgba(212,168,71,.07); font-weight: 500; }
  .league-table tr.rel-zone { border-top: 1px solid color-mix(in srgb,var(--red) 40%,transparent); }
  .league-table tr.pro-zone { border-top: 1px solid color-mix(in srgb,var(--green) 40%,transparent); }

  .legend { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

  /* ── Fixtures ────────────────────────────────────────── */
  .matchday-block { margin-bottom: 16px; }
  .matchday-heading {
    font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); padding: 4px 0; margin-bottom: 2px;
    display: flex; align-items: center; gap: 8px;
  }
  .matchday-heading::after { content: ''; flex: 1; border-top: 1px solid var(--border); }
  .matchday-heading.current { color: var(--gold); }

  .fixture-row {
    display: flex; align-items: center; padding: 6px 0;
    font-size: 13px; border-bottom: 1px solid var(--surface2); gap: 8px;
  }
  .fixture-row:last-child { border-bottom: none; }
  .fixture-home { flex: 1; text-align: right; }
  .fixture-away { flex: 1; }
  .fixture-score { min-width: 60px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; font-size: 14px; }
  .fixture-score.upcoming { color: var(--muted); font-size: 11px; font-weight: 400; letter-spacing: .05em; }
  .fixture-row.player-fixture .fixture-home,
  .fixture-row.player-fixture .fixture-away { font-weight: 600; color: var(--gold); }
  .fixture-row.played { opacity: .8; }
  :global(.rw) { color: var(--green); }
  :global(.rl) { color: var(--red); }
  :global(.rd) { color: var(--amber); }
  .bold { font-weight: 700; }

  /* ── Squad ───────────────────────────────────────────── */
  .team-rating-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 12px 16px; }
  .tactic-row { display: flex; align-items: center; gap: 12px; }
  .tactic-btns { display: flex; gap: 6px; }
  .tactic-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; color: var(--text-dim); font-family: var(--font-body); font-size: 12px; font-weight: 600; padding: 6px 12px; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
  .tactic-btn:hover { border-color: var(--gold-dim); color: var(--text); }
  .tactic-btn.active { border-color: var(--gold); color: var(--gold); background: rgba(212,168,71,.1); }

  .swap-hint { font-size: 11px; color: var(--text-dim); margin-bottom: 10px; font-style: italic; }
  .swap-hint.muted { color: var(--muted); }

  .squad-table { width: 100%; border-collapse: separate; border-spacing: 0 2px; font-size: 13px; }
  .squad-table th { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); padding: 8px 8px; text-align: left; border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
  .squad-table th:hover { color: var(--text); }
  .squad-table th.num { text-align: right; }
  .squad-table th.sorted { color: var(--gold); }
  .squad-table td { padding: 8px 8px; font-variant-numeric: tabular-nums; }
  .squad-table td.num { text-align: right; }
  .squad-table tr.starter td { border-top: 1px solid color-mix(in srgb,var(--green) 35%,transparent); border-bottom: 1px solid color-mix(in srgb,var(--green) 35%,transparent); }
  .squad-table tr.starter td:first-child { border-left: 1px solid color-mix(in srgb,var(--green) 35%,transparent); border-radius: 5px 0 0 5px; }
  .squad-table tr.starter td:last-child  { border-right: 1px solid color-mix(in srgb,var(--green) 35%,transparent); border-radius: 0 5px 5px 0; }
  .squad-table tr.rotation td { border-top: 1px solid color-mix(in srgb,var(--red) 35%,transparent); border-bottom: 1px solid color-mix(in srgb,var(--red) 35%,transparent); }
  .squad-table tr.rotation td:first-child { border-left: 1px solid color-mix(in srgb,var(--red) 35%,transparent); border-radius: 5px 0 0 5px; }
  .squad-table tr.rotation td:last-child  { border-right: 1px solid color-mix(in srgb,var(--red) 35%,transparent); border-radius: 0 5px 5px 0; }
  .squad-table tr.swap-target { cursor: pointer; }
  .squad-table tr.swap-target td { background: color-mix(in srgb,var(--gold) 8%,transparent); }
  .squad-table tr.swap-target:hover td { background: color-mix(in srgb,var(--gold) 14%,transparent); }
  .squad-table tr.swap-inactive { opacity: .35; pointer-events: none; }

  .swap-handle { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 3px; font-size: 14px; color: var(--muted); cursor: pointer; background: none; border: none; transition: color .15s, background .15s; }
  .swap-handle:hover { color: var(--text); background: var(--surface3); }
  .swap-handle.swap-active { background: var(--surface3); color: var(--gold); }
  .swap-handle:disabled { opacity: .3; cursor: not-allowed; }

  :global(.pos-badge) { display: inline-block; padding: 1px 5px; border-radius: 2px; font-size: 10px; font-weight: 600; letter-spacing: .04em; background: var(--surface3); color: var(--text-dim); }
  :global(.pos-gk)  { background: #1a2a3a; color: #5ab0e0; }
  :global(.pos-def) { background: #1a2a1a; color: #5acf7a; }
  :global(.pos-mid) { background: #2a1a1a; color: #e0a050; }
  :global(.pos-fwd) { background: #2a1a2a; color: #d06090; }
  :global(.status-badge) { display: inline-block; padding: 1px 5px; border-radius: 2px; font-size: 10px; font-weight: 600; letter-spacing: .05em; }
  :global(.status-starter)  { background: color-mix(in srgb,var(--green) 15%,transparent); color: var(--green); }
  :global(.status-rotation) { background: var(--surface3); color: var(--text-dim); }
  :global(.rating-bar-wrap) { display: inline-flex; align-items: center; gap: 6px; }
  :global(.rating-bar-track) { width: 36px; height: 4px; background: var(--surface3); border-radius: 2px; overflow: hidden; }
  :global(.rating-bar-fill)  { height: 100%; border-radius: 2px; background: var(--gold); }
  :global(.rating-num) { font-size: 12px; color: var(--text-dim); min-width: 20px; text-align: right; }

  /* ── Questions tab ───────────────────────────────────── */
  .qset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .qset-card {
    background: var(--surface2); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
    padding: 12px 14px; cursor: pointer; transition: border-color .15s, background .15s;
    text-align: left; color: var(--text); font-family: var(--font-body); position: relative;
  }
  .qset-card:hover    { border-color: var(--gold-dim); }
  .qset-card.selected { border-color: var(--gold); background: color-mix(in srgb,var(--gold) 10%,var(--surface2)); }
  .qset-card-full { width: 100%; display: block; }
  .qset-card-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
  .qset-card-desc { font-size: 11px; color: var(--text-dim); line-height: 1.4; }
  .qset-card-top  { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .qset-stats { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
  .tier-badge { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; font-weight: 600; }
  .qset-total { font-size: 11px; color: var(--text-dim); margin-left: 2px; }
  .qset-clear { margin-left: auto; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1; }
  .qset-clear:hover { color: var(--red); }

  .module-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; font-weight: 600; }
  .tag-default { background: rgba(74,158,232,.15); color: #5ab0e0; }
  .tag-library { background: rgba(74,232,122,.15); color: var(--green); }
  .tag-public  { background: rgba(180,74,232,.15); color: #b44ae8; }
  .tag-group   { background: rgba(212,168,71,.15);  color: var(--gold); }

  .browse-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .browse-btn {
    flex: 1; min-width: 160px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 4px; padding: 12px 14px; cursor: pointer; display: flex;
    align-items: center; gap: 10px; font-family: var(--font-body); text-align: left;
    color: var(--text); transition: border-color .15s;
  }
  .browse-btn:hover { border-color: var(--gold-dim); }
  .browse-btn-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .browse-btn-text strong { font-size: 13px; font-weight: 600; }
  .browse-btn-text span   { font-size: 11px; color: var(--muted); }
  .qscore-stats { display: flex; gap: 12px; font-size: 11px; }

  /* ── Browse modal ────────────────────────────────────── */
  .lib-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .lib-modal   { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; width: 90%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
  .lib-header  { display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .lib-tabs    { display: flex; flex: 1; }
  .lib-tab     { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: var(--muted); font-family: var(--font-body); font-size: 13px; font-weight: 600; padding: 14px 16px; cursor: pointer; transition: color .15s, border-color .15s; }
  .lib-tab:hover { color: var(--text); }
  .lib-tab.active { color: var(--gold); border-bottom-color: var(--gold); }
  .lib-close   { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; padding: 4px 8px; }
  .lib-list    { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .lib-item    { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 12px 14px; cursor: pointer; text-align: left; width: 100%; color: var(--text); font-family: var(--font-body); transition: border-color .15s; }
  .lib-item:hover    { border-color: var(--gold-dim); }
  .lib-item.selected { border-color: var(--gold); background: color-mix(in srgb,var(--gold) 8%,var(--surface2)); }
  .lib-item-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .lib-item-meta { font-size: 11px; color: var(--muted); }
  .lib-empty   { padding: 32px 20px; text-align: center; color: var(--muted); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .lib-footer  { display: flex; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .lib-sublabel { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 4px 2px 2px; }
  .lib-group-item { border-left: 3px solid var(--gc); }
  .lib-group-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .group-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: rgba(212,168,71,.15); color: var(--gold); }
  .default-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: rgba(74,158,232,.15); color: #5ab0e0; }
  .active-tag-sm { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: rgba(212,168,71,.15); color: var(--gold); }
  .star-ind { color: var(--gold); font-size: 12px; flex-shrink: 0; }
  .lib-login { color: var(--gold); font-size: 13px; text-decoration: none; }
  .lib-login:hover { text-decoration: underline; }

  /* ── Info tab ────────────────────────────────────────── */
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .stat-cell { display: flex; flex-direction: column; gap: 4px; }
  .stat-label { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .stat-val { font-family: var(--font-display); font-size: 24px; color: var(--gold); }
  .stat-val.record { font-size: 18px; }

  .mod-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--surface2); cursor: pointer; transition: opacity .15s; }
  .mod-row:last-child { border-bottom: none; }
  .mod-row:hover { opacity: .8; }
  .mod-row.active-mod { cursor: default; }
  .mod-row.active-mod:hover { opacity: 1; }
  .mod-name { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
  .mod-desc { font-size: 11px; color: var(--muted); }
  .active-tag { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: rgba(212,168,71,.15); color: var(--gold); flex-shrink: 0; }
  .qscore-stats { display: flex; gap: 12px; font-size: 11px; margin-top: 8px; }

  /* ── Buttons ─────────────────────────────────────────── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
  .btn:hover  { opacity: .85; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #0a0a0c; }
  .btn-danger  { background: color-mix(in srgb,var(--red) 20%,transparent); color: var(--red); border: 1px solid color-mix(in srgb,var(--red) 30%,transparent); }
  .btn-sm { padding: 6px 12px; font-size: 11px; }

  @media (max-width: 640px) {
    .hub-tabs { overflow-x: auto; }
    .hub-tab  { font-size: 11px; padding: 8px 12px; flex-shrink: 0; }
    .stat-grid { grid-template-columns: 1fr 1fr; }
    .league-table th:nth-child(n+4):nth-child(-n+9),
    .league-table td:nth-child(n+4):nth-child(-n+9) { display: none; }
  }
</style>
