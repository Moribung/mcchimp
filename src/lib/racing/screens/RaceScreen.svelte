<!-- src/lib/racing/screens/RaceScreen.svelte -->
<!-- Split layout: the live track + duel panel on the left, standings on the
     right. Phases: running (track zoomed out, cars drift) → break (zoomed in,
     halted, pick difficulty) → question (timed) → resolve (zoom in, swap). -->
<script>
  import { state as gs } from '$lib/racing/state.svelte.js';
  import {
    COMMITMENTS, COMMIT_ORDER, STANCES, DIFF_COLORS, DIFF_BG, DIFF_LABELS,
    FIELD_SIZE, WEAR_THRESHOLD, WEAR_CRITICAL, DUEL_TIMER_MS, SIM, ordinal,
  } from '$lib/racing/constants.js';
  import { trackById } from '$lib/racing/tracks.js';
  import QuestionCard from './QuestionCard.svelte';
  import TrackScene from './TrackScene.svelte';

  const { onskip, onlightsout, onpickcommitment, onanswer, oncontinue, onpitbox, onpitstay, onquit } = $props();

  const r   = $derived(gs.race);
  const pos = $derived(r.playerIdx + 1);
  const track = $derived(trackById(r.trackId));

  const lap = $derived(Math.min(r.totalLaps, Math.floor(r.field[r.playerIdx].dist / SIM.LAP_DIST) + 1));
  const raceProgress = $derived(Math.max(0, Math.min(100, Math.round(r.field[r.playerIdx].dist / (r.totalLaps * SIM.LAP_DIST) * 100))));

  // Starting lights: five reds light up one by one, then out → go.
  let litCount = $state(0);
  $effect(() => {
    if (r.phase === 'grid') {
      litCount = 0;
      const id = setInterval(() => {
        litCount += 1;
        if (litCount >= 5) {
          clearInterval(id);
          setTimeout(() => onlightsout?.(), 700 + Math.random() * 800);
        }
      }, 600);
      return () => clearInterval(id);
    }
  });

  const wearPct = $derived(Math.round(r.tireWear * 100));
  const wearColor = $derived(
    r.tireWear >= WEAR_CRITICAL ? 'var(--red)'
    : r.tireWear >= WEAR_THRESHOLD ? '#e8944a'
    : 'var(--green)'
  );

  const typeLabel = $derived(
    r.duel?.type === 'attack' ? 'Attacking'
    : r.duel?.type === 'defend' ? 'Defending'
    : 'Caught in traffic'
  );

  const duelContext = $derived((() => {
    const d = r.duel;
    if (!d) return '';
    if (d.type === 'attack')  return `Attacking ${d.ahead?.name ?? 'the car ahead'}`;
    if (d.type === 'defend')  return `Defending from ${d.behind?.name ?? 'the car behind'}`;
    return `${d.ahead?.name ?? 'ahead'} ahead · ${d.behind?.name ?? 'behind'} closing`;
  })());

  const recommended = $derived(STANCES[r.stance]?.default ?? 'push');

  const outcome = $derived((() => {
    const d = r.duel;
    if (!d || d.band == null) return null;
    const newPos = d.newPos ?? pos;
    if (d.band === 'gain') {
      if (d.posDelta > 1)  return { cls: 'good', head: `Double move! +${d.posDelta}`, sub: `Up to ${ordinal(newPos)}.` };
      if (d.posDelta === 1) return { cls: 'good', head: 'Overtake!', sub: `Up to ${ordinal(newPos)}.` };
      if (d.type === 'defend') return { cls: 'good', head: 'Held firm', sub: `Door slammed — still ${ordinal(newPos)}.` };
      return { cls: 'good', head: 'Out front', sub: `Leading — nothing to catch.` };
    }
    if (d.band === 'hold') return { cls: 'hold', head: 'Held position', sub: `No change — still ${ordinal(newPos)}.` };
    if (d.posDelta < 0) return { cls: 'bad', head: 'Getting passed', sub: `Slips to ${ordinal(newPos)}.` };
    return { cls: 'hold', head: 'Ran wide', sub: `Held last — still ${ordinal(newPos)}.` };
  })());

  const exitHint = $derived(r.duel?.exit >= 0.6 ? 'Clean exit — charging on' : r.duel?.exit <= 0.3 ? 'Poor exit — on the defensive' : 'Settling back in');
</script>

<div class="race-grid">

  <!-- ═══ LEFT: live track + duel ═══ -->
  <div class="race-main">
    <div class="lap-bar">
      <div class="lap-cell"><span class="lap-num">Lap {lap}</span><span class="lap-of">/ {r.totalLaps}</span></div>
      <span class="track-name">{track.name}</span>
      <div class="lap-prog-wrap"><div class="lap-prog"><div class="lap-prog-fill" style="width:{raceProgress}%"></div></div></div>
    </div>

    <TrackScene />

    <div class="panel">
      {#if r.phase === 'grid'}
        <div class="grid-start">
          <div class="lights">
            {#each Array(5) as _, i}
              <span class="light" class:lit={i < litCount}></span>
            {/each}
          </div>
          <div class="grid-msg">Starting grid</div>
          <div class="grid-sub">You start {ordinal(pos)} on the grid · lights out soon…</div>
        </div>

      {:else if r.phase === 'running'}
        <div class="running">
          <div class="run-tag">On track · {ordinal(pos)}</div>
          <div class="run-line">Racing…</div>
          <button class="btn btn-ghost run-skip" onclick={() => onskip?.()}>Force a move →</button>
        </div>

      {:else if r.phase === 'break'}
        <div class="break-head">
          <span class="paused"><span class="paused-dot">⏸</span> Race paused</span>
          <span class="break-type">{typeLabel}</span>
        </div>
        <div class="context">{duelContext}</div>

        <div class="commit-label">Commit to the duel — this is your question difficulty</div>
        <div class="commits">
          {#each COMMIT_ORDER as id}
            {@const c = COMMITMENTS[id]}
            <button class="commit-btn" class:rec={id === recommended} onclick={() => onpickcommitment(id)}>
              <div class="commit-top">
                <span class="commit-label-x">{c.label}{#if id === recommended}<span class="rec-tag">default</span>{/if}</span>
                <span class="commit-tier" style="background:{DIFF_BG[c.tier]};color:{DIFF_COLORS[c.tier]}">{DIFF_LABELS[c.tier]}</span>
              </div>
              <div class="commit-blurb">{c.blurb}</div>
              <div class="commit-meta"><span>Win up to +{c.maxGain}</span><span>Miss: −{c.wrongLoss}</span></div>
            </button>
          {/each}
        </div>

        <button class="quit-btn" onclick={onquit}>Retire from race</button>

      {:else if r.phase === 'pitdecision'}
        <div class="break-head">
          <span class="paused"><span class="paused-dot">⏸</span> Pit straight</span>
          <span class="break-type">Lap {lap}</span>
        </div>
        <div class="context">You're crossing the pit entry. Tyres are {wearPct}% worn.</div>
        <div class="pit-choice">
          <button class="pit-box" class:urge={r.tireWear >= WEAR_CRITICAL} onclick={onpitbox}>
            🛞 Box now
            <span class="pit-sub">change tyres — costs track position, but fresh rubber</span>
          </button>
          <button class="pit-out" onclick={onpitstay}>
            Stay out
            <span class="pit-sub">keep your position — tyres keep wearing</span>
          </button>
        </div>

      {:else if r.phase === 'question'}
        <div class="context context-q">{duelContext}</div>
        {#key r.duel?.q?.id}
          <QuestionCard q={r.duel.q} tier={r.duel.tier} timerMs={DUEL_TIMER_MS} submitLabel="Commit" onanswer={onanswer} />
        {/key}

      {:else if r.phase === 'resolve' && outcome}
        <div class="outcome outcome-{outcome.cls}">
          <div class="outcome-head">{outcome.head}</div>
          <div class="outcome-sub">{outcome.sub}</div>
        </div>
        {#if r.duel?.q?.explanation}
          <div class="outcome-exp">{r.duel.q.explanation}</div>
        {/if}
        <div class="exit-hint">{exitHint}</div>
        <button class="btn btn-primary btn-lg next-btn" onclick={oncontinue}>Back on track →</button>
      {/if}
    </div>
  </div>

  <!-- ═══ RIGHT: standings ═══ -->
  <aside class="race-side">
    <div class="side-pos">
      <div class="pos-num">{ordinal(pos)}</div>
      <div class="pos-of">of {FIELD_SIZE}</div>
      <div class="pos-label">Position</div>
    </div>

    <div class="tyre">
      <div class="tyre-top">
        <span class="tyre-label">Tyres</span>
        <span class="tyre-pct" style="color:{wearColor}">{wearPct}% worn{r.tireWear >= WEAR_CRITICAL ? ' · pit!' : ''}</span>
      </div>
      <div class="tyre-bar">
        <div class="tyre-fill" style="width:{wearPct}%;background:{wearColor}"></div>
        <div class="tyre-mark" style="left:{WEAR_THRESHOLD * 100}%"></div>
      </div>
    </div>

    <div class="side-card">
      <div class="sc-title">Race Order</div>
      <div class="ladder">
        {#each r.field as car, i (car.id)}
          <div class="rung" class:me={car.isPlayer}>
            <span class="rung-pos">{i + 1}</span>
            <span class="rung-swatch" style="background:{car.color}"></span>
            <span class="rung-name">{car.isPlayer ? 'You' : car.name}</span>
          </div>
        {/each}
      </div>
    </div>
  </aside>
</div>

<style>
  .race-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; max-width: 1080px; margin: 0 auto; padding: 20px 24px 40px; align-items: start; }
  .race-main { min-width: 0; display: flex; flex-direction: column; gap: 14px; }

  .lap-bar { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px 16px; }
  .lap-cell { display: flex; align-items: baseline; gap: 5px; }
  .lap-num { font-family: var(--font-display); font-size: 18px; letter-spacing: .03em; color: var(--text); }
  .lap-of { font-size: 12px; color: var(--muted); }
  .track-name { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); }
  .lap-prog-wrap { flex: 1; }
  .lap-prog { height: 5px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
  .lap-prog-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width .3s; }

  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px; min-height: 200px; display: flex; flex-direction: column; gap: 12px; }

  .grid-start { display: flex; flex-direction: column; gap: 12px; align-items: center; margin: auto 0; }
  .lights { display: flex; gap: 8px; }
  .light { width: 26px; height: 26px; border-radius: 50%; background: #3a1414; border: 1px solid #511; transition: background .15s, box-shadow .15s; }
  .light.lit { background: var(--red); border-color: var(--red); box-shadow: 0 0 10px rgba(224,82,82,.6); }
  .grid-msg { font-family: var(--font-display); font-size: 26px; letter-spacing: .04em; color: var(--text); }
  .grid-sub { font-size: 12px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }

  .running { display: flex; flex-direction: column; gap: 10px; align-items: center; margin: auto 0; }
  .run-tag { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .run-line { font-family: var(--font-display); font-size: 22px; letter-spacing: .02em; text-align: center; color: var(--text); }

  .break-head { display: flex; align-items: center; justify-content: space-between; }
  .paused { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber); font-weight: 600; }
  .paused-dot { margin-right: 4px; }
  .break-type { font-family: var(--font-display); font-size: 20px; letter-spacing: .03em; color: var(--text); }
  .context { font-size: 13px; color: var(--text-muted); text-align: center; }
  .context-q { margin-bottom: 4px; }

  .commit-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; text-align: center; margin-top: 2px; }
  .commits { display: flex; flex-direction: column; gap: 8px; }
  .commit-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 12px 14px; cursor: pointer; text-align: left; color: var(--text); transition: border-color .12s, background .12s; }
  .commit-btn:hover { border-color: var(--accent); background: rgba(212,168,71,.06); }
  .commit-btn.rec { border-color: var(--accent-border); }
  .commit-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .commit-label-x { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; display: flex; align-items: center; gap: 8px; }
  .rec-tag { font-size: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); background: rgba(212,168,71,.12); padding: 2px 6px; border-radius: 2px; }
  .commit-tier { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 2px; }
  .commit-blurb { font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 6px; }
  .commit-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }

  .pit-choice { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .pit-box, .pit-out {
    display: flex; flex-direction: column; gap: 3px; align-items: center; text-align: center;
    border-radius: 5px; padding: 14px; cursor: pointer; font-family: var(--font-display);
    font-size: 18px; letter-spacing: .03em; transition: background .15s, border-color .15s;
  }
  .pit-box { background: rgba(212,168,71,.08); border: 1px solid var(--accent-border); color: var(--accent); }
  .pit-box:hover { background: rgba(212,168,71,.16); border-color: var(--accent); }
  .pit-box.urge { border-color: var(--red); color: var(--red); background: rgba(224,82,82,.1); }
  .pit-out { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
  .pit-out:hover { border-color: var(--border-hover); }
  .pit-sub { font-family: var(--font-body); font-size: 11px; font-weight: 400; letter-spacing: normal; color: var(--muted); text-transform: none; }

  .quit-btn { background: none; border: none; color: var(--muted); font-family: var(--font-body); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; padding: 4px; }
  .quit-btn:hover { color: var(--red); }

  .outcome { text-align: center; padding: 4px 0 2px; }
  .outcome-head { font-family: var(--font-display); font-size: 34px; letter-spacing: .03em; }
  .outcome-sub { font-size: 14px; color: var(--text-muted); margin-top: 2px; }
  .outcome-good .outcome-head { color: var(--green); }
  .outcome-bad  .outcome-head { color: var(--red); }
  .outcome-hold .outcome-head { color: var(--accent); }
  .outcome-exp { font-size: 12px; color: var(--muted); line-height: 1.6; padding: 10px 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); }
  .exit-hint { font-size: 11px; color: var(--muted); text-align: center; font-style: italic; }
  .next-btn { width: 100%; margin-top: auto; }

  .race-side { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 16px; }
  .side-pos { background: var(--surface); border: 1px solid var(--accent-border); border-radius: 6px; padding: 16px; text-align: center; }
  .pos-num { font-family: var(--font-display); font-size: 52px; line-height: .9; color: var(--accent); letter-spacing: .02em; }
  .pos-of { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .pos-label { font-size: 9px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-top: 8px; }

  .tyre { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; }
  .tyre-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 7px; }
  .tyre-label { font-size: 9px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .tyre-pct { font-size: 12px; font-weight: 600; }
  .tyre-bar { position: relative; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
  .tyre-fill { height: 100%; border-radius: 4px; transition: width .3s, background .3s; }
  .tyre-mark { position: absolute; top: -2px; width: 2px; height: 12px; background: rgba(255,255,255,.4); }

  .side-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; }
  .sc-title { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .ladder { display: flex; flex-direction: column; gap: 1px; max-height: 360px; overflow-y: auto; }
  .rung { display: flex; align-items: center; gap: 9px; padding: 5px 8px; border-radius: 3px; font-size: 12px; }
  .rung-pos { font-family: var(--font-display); font-size: 13px; color: var(--muted); min-width: 20px; text-align: right; }
  .rung-swatch { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
  .rung-name { flex: 1; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rung.me { background: var(--accent-dim); }
  .rung.me .rung-pos { color: var(--accent); }
  .rung.me .rung-name { color: var(--accent); font-weight: 700; }

  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 11px 26px; border: none; border-radius: 3px; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: opacity .15s; }
  .btn:hover { opacity: .85; }
  .btn-primary { background: var(--accent); color: #0a0a0c; }
  .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-lg { padding: 14px 32px; font-size: 15px; letter-spacing: .1em; }

  @media (max-width: 860px) {
    .race-grid { grid-template-columns: 1fr; padding: 14px 14px 32px; gap: 14px; max-width: 560px; }
    .race-side { position: static; }
    .side-pos { display: flex; align-items: baseline; justify-content: center; gap: 10px; text-align: left; }
    .pos-num { font-size: 34px; }
    .pos-label { margin-top: 0; align-self: center; }
    .ladder { max-height: 220px; }
  }
</style>
