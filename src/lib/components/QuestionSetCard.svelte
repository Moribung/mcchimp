<script>
  // Reusable question-set card, styled to match the library cards.
  // `set` is a user_question_sets row; `actions` is an optional snippet rendered
  // in the card footer (the caller supplies the buttons it needs).
  let { set, actions } = $props();

  const TIER_KEYS = ['easy', 'medium', 'hard', 'elite'];
  const tierBreakdown = $derived(
    TIER_KEYS
      .map((k) => ({ k, n: Array.isArray(set?.data?.tiers?.[k]) ? set.data.tiers[k].length : 0 }))
      .filter((x) => x.n > 0)
  );
</script>

<div class="set-card">
  <div class="set-card-top">
    <div class="set-name">{set.name}</div>
    <span class="set-count">{set.question_count} q</span>
  </div>

  {#if set.description}<p class="set-desc">{set.description}</p>{/if}

  {#if tierBreakdown.length}
    <div class="tier-chips">
      {#each tierBreakdown as t}<span class="tier-chip tc-{t.k}">{t.k} · {t.n}</span>{/each}
    </div>
  {/if}

  {#if set.ai_note}<div class="ai-note">{set.ai_note}</div>{/if}

  {#if actions}<div class="qsc-actions">{@render actions(set)}</div>{/if}
</div>

<style>
  .set-card {
    background: var(--surface); border: 1px solid rgba(255,255,255,0.04);
    padding: 28px; display: flex; flex-direction: column; gap: 10px; position: relative;
    transition: transform .15s, box-shadow .15s;
  }
  .set-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
  .set-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .set-name { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: .04em; color: var(--white); line-height: 1.1; }
  .set-count { font-size: 12px; color: var(--muted); white-space: nowrap; padding-top: 4px; }
  .set-desc { font-size: 13px; color: rgba(242,239,232,0.45); line-height: 1.5; }

  .tier-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .tier-chip {
    font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 2px;
    border: 1px solid; color: var(--muted);
  }
  .tc-easy { color: #4CAF85; border-color: rgba(46,139,87,0.3); background: rgba(46,139,87,0.08); }
  .tc-medium { color: var(--gold); border-color: rgba(232,193,74,0.3); background: rgba(232,193,74,0.08); }
  .tc-hard { color: #6B9FE4; border-color: rgba(42,94,173,0.35); background: rgba(42,94,173,0.1); }
  .tc-elite { color: #C07AEA; border-color: rgba(180,74,232,0.35); background: rgba(180,74,232,0.1); }

  .ai-note {
    font-size: 12px; color: var(--muted); line-height: 1.5;
    background: rgba(232,193,74,0.06); border: 1px solid rgba(232,193,74,0.18);
    border-radius: 3px; padding: 8px 10px;
  }

  .qsc-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
</style>
