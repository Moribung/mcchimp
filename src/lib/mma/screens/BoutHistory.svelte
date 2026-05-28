<!-- src/lib/mma/screens/BoutHistory.svelte -->
<!-- Bout history table — standalone component for the right sidebar -->
<script>
  import { state as gs } from '$lib/mma/state.svelte.js';
  import { CHAMP_SLOT, RANKED_START } from '$lib/mma/constants.js';

  const PHASE_NAMES = { 1: 'Regional FC', 2: 'Apex Combat', 3: 'GFL' };

  function rankLabel(s) {
    if (s === null || s === undefined) return '';
    if (s === CHAMP_SLOT) return 'C';
    if (s < RANKED_START) return 'UR';
    return `#${CHAMP_SLOT - s}`;
  }

  const bouts = $derived(gs.boutHistory || []);
</script>

{#if bouts.length > 0}
  <div class="bout-history">
    <div class="bh-header">
      <span>Bout History</span>
      <span>{bouts.length} fight{bouts.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="bh-scroll">
      <table class="bh-table">
        <thead>
          <tr><th></th><th>Opponent</th><th>Outcome</th><th>Method</th><th>Org</th><th>#</th></tr>
        </thead>
        <tbody>
          {#each bouts as b}
            {@const rc   = b.rc || 'loss'}
            {@const rank = rankLabel(b.oppRankSlot)}
            {@const org  = PHASE_NAMES[b.phase || 1] || ''}
            <tr>
              <td class="bh-res-cell"><span class="bh-dot {rc}"></span></td>
              <td>
                <span class="bh-opp-name">{b.oppName || 'Unknown'}</span>
                {#if rank}<span class="bh-rank">{rank}</span>{/if}
              </td>
              <td class="bh-outcome">{b.outcome || ''}</td>
              <td class="bh-method">{b.method || ''}</td>
              <td><span class="bh-div bh-div-{b.phase || 1}">{org}</span></td>
              <td class="bh-fn">#{b.fn ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<style>
  .bout-history { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
  .bh-header { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-muted); padding:8px 14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
  .bh-scroll { max-height:280px; overflow-y:auto; }
  .bh-scroll::-webkit-scrollbar { width:4px; }
  .bh-scroll::-webkit-scrollbar-track { background:transparent; }
  .bh-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
  .bh-table { width:100%; border-collapse:collapse; font-size:11px; }
  .bh-table th { font-size:9px; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-muted); padding:5px 10px; text-align:left; border-bottom:1px solid var(--border); background:var(--surface2); position:sticky; top:0; z-index:1; }
  .bh-table td { padding:6px 10px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
  .bh-table tr:last-child td { border-bottom:none; }
  .bh-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
  .bh-dot.win { background:var(--green); } .bh-dot.draw { background:var(--amber); } .bh-dot.loss { background:var(--red); } .bh-dot.finish { background:#8b0000; }
  .bh-res-cell { width:16px; }
  .bh-fn      { color:var(--text-muted); font-size:10px; text-align:right; white-space:nowrap; }
  .bh-opp-name { font-weight:500; }
  .bh-rank    { color:var(--text-muted); font-size:10px; white-space:nowrap; margin-left:4px; }
  .bh-outcome { color:var(--text); white-space:nowrap; }
  .bh-method  { color:var(--text-muted); font-style:italic; font-size:10px; white-space:nowrap; }
  .bh-div { font-size:9px; letter-spacing:0.06em; padding:1px 5px; border-radius:2px; font-weight:600; }
  .bh-div-1 { background:rgba(255,255,255,.06); color:var(--text-muted); }
  .bh-div-2 { background:rgba(74,158,232,.12);  color:var(--blue); }
  .bh-div-3 { background:rgba(232,193,74,.12);  color:var(--accent); }
</style>
