<script>
  import { onMount } from 'svelte';
  import { fetchAllSets } from '$lib/questions';

  let sets = $state([]);
  let setsStatus = $state('loading');
  let previewOpen = $state({});

  onMount(async () => {
    try {
      sets = await fetchAllSets();
      setsStatus = 'done';
    } catch(e) {
      setsStatus = 'error';
    }
  });

  function togglePreview(filename) {
    previewOpen[filename] = !previewOpen[filename];
  }

  function tierCounts(data) {
    const t = data?.tiers || {};
    return {
      easy:   (t.easy   || []).length,
      medium: (t.medium || []).length,
      hard:   (t.hard   || []).length,
      elite:  (t.elite  || []).length,
    };
  }

  function sampleQuestion(data) {
    for (const t of ['easy','medium','hard','elite']) {
      if (data?.tiers?.[t]?.length) return data.tiers[t][0];
    }
    return null;
  }
</script>

<svelte:head>
  <title>Question Sets — McChimp</title>
</svelte:head>

<div class="sets-wrap">
  {#if setsStatus === 'loading'}
    <p class="sets-loading">Loading question sets…</p>
  {:else if setsStatus === 'error'}
    <p class="sets-error">Could not load question sets. Make sure index.json exists in /questions/.</p>
  {:else}
    <div class="sets-grid">
      {#each sets as { filename, data }}
        {#if !data}
          <div class="set-card">
            <div class="set-name">{filename}</div>
            <p class="set-desc" style="color:#D94040">Could not load this file.</p>
          </div>
        {:else}
          {@const counts = tierCounts(data)}
          {@const total = counts.easy + counts.medium + counts.hard + counts.elite}
          {@const sample = sampleQuestion(data)}
          <div class="set-card">
            <div class="set-card-top">
              <div class="set-name">{data.name || filename}</div>
              <span style="font-size:13px;color:var(--muted);white-space:nowrap;">{total} q</span>
            </div>
            {#if data.description}<p class="set-desc">{data.description}</p>{/if}
            <div class="set-tiers">
              {#if counts.easy}  <span class="set-tier tier-e">Easy · {counts.easy}</span>{/if}
              {#if counts.medium}<span class="set-tier tier-m">Medium · {counts.medium}</span>{/if}
              {#if counts.hard}  <span class="set-tier tier-h">Hard · {counts.hard}</span>{/if}
              {#if counts.elite} <span class="set-tier tier-x">Elite · {counts.elite}</span>{/if}
            </div>
            <div class="set-actions">
              <a class="set-dl" href="/questions/{filename}" download={filename}>&#11015; Download JSON</a>
              <button class="set-preview-btn" onclick={() => togglePreview(filename)}>
                {previewOpen[filename] ? 'Hide' : 'Preview'}
              </button>
            </div>
            {#if previewOpen[filename] && sample}
              <div class="set-preview">
                <div class="preview-label">Sample question</div>
                <div class="preview-q">{sample.question}</div>
                <div class="preview-opts">
                  {#each sample.options as opt, i}
                    <div class="preview-opt" class:correct={(sample.answers || []).includes(i)}>
                      {(sample.answers || []).includes(i) ? '✓ ' : ''}{opt}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .sets-wrap { padding: 64px 48px; }
  .sets-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 2px; max-width: 1100px; }
  .set-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.04); padding: 32px; display: flex; flex-direction: column; }
  .set-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .set-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: .04em; color: var(--white); line-height: 1.1; }
  .set-desc { font-size: 13px; color: rgba(242,239,232,0.45); line-height: 1.6; margin-bottom: 16px; flex: 1; }
  .set-tiers { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
  .set-tier { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 2px; }
  .tier-e { background: rgba(46,139,87,0.12); color: #4CAF85; border: 1px solid rgba(46,139,87,0.25); }
  .tier-m { background: rgba(232,193,74,0.10); color: var(--gold); border: 1px solid rgba(232,193,74,0.25); }
  .tier-h { background: rgba(42,94,173,0.12); color: #6B9FE4; border: 1px solid rgba(42,94,173,0.25); }
  .tier-x { background: rgba(180,74,232,0.10); color: #C07AEA; border: 1px solid rgba(180,74,232,0.25); }
  .set-actions { display: flex; gap: 8px; align-items: center; margin-top: auto; }
  .set-dl { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: var(--gold); color: var(--black); border: none; padding: 9px 18px; border-radius: 2px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background .15s; white-space: nowrap; }
  .set-dl:hover { background: var(--gold2); }
  .set-preview-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.1); padding: 9px 16px; border-radius: 2px; cursor: pointer; transition: color .15s, border-color .15s; }
  .set-preview-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
  .set-preview { margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
  .preview-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .preview-q { font-size: 13px; color: var(--white); margin-bottom: 8px; line-height: 1.5; }
  .preview-opt { font-size: 12px; color: rgba(242,239,232,0.45); padding: 4px 0; }
  .preview-opt.correct { color: #4CAF85; }
  .sets-loading { color: var(--muted); font-size: 14px; padding: 64px 0; }
  .sets-error { color: #D94040; font-size: 13px; padding: 32px 0; }

  @media (max-width: 900px) { .sets-wrap { padding: 40px 24px; } }
</style>