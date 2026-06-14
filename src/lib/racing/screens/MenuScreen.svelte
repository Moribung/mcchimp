<!-- src/lib/racing/screens/MenuScreen.svelte -->
<script>
  const { onstart } = $props();
</script>

<div class="menu-wrap">
  <div class="start-header">
    <h1>APEX</h1>
    <p>Quiz Racing — every corner is a question</p>
  </div>

  <button class="menu-btn menu-btn-new" onclick={onstart}>
    <div class="menu-btn-icon">▶</div>
    <div class="menu-btn-body">
      <div class="menu-btn-title">Start Race</div>
      <div class="menu-btn-sub">Pick a car and a question set, then climb the field</div>
    </div>
  </button>

  <div class="how">
    <div class="how-title">How it races</div>
    <ul>
      <li><strong>Pick a gear</strong> before each corner. Push harder for tougher questions and bigger overtakes.</li>
      <li><strong>Answer right</strong> to attack the car ahead — <strong>wrong</strong> and the pack comes back at you.</li>
      <li><strong>Coast</strong> on easy questions to hold station and save your tyres.</li>
      <li><strong>Pit</strong> when the rubber's gone: change tyres fast under the clock, or lose places fumbling.</li>
    </ul>
  </div>
</div>

<style>
  .menu-wrap { max-width: 480px; margin: 0 auto; padding: 56px 0 48px; display: flex; flex-direction: column; gap: 14px; }

  .start-header { text-align: center; margin-bottom: 30px; }
  .start-header h1 { font-family: var(--font-display); font-size: 96px; line-height: 0.9; color: var(--accent); letter-spacing: .02em; }
  .start-header p  { color: var(--muted); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-top: 8px; }

  .menu-btn {
    width: 100%; background: var(--surface); border: 1px solid rgba(212,168,71,.3);
    border-radius: 4px; padding: 18px 20px; cursor: pointer;
    display: flex; align-items: center; gap: 16px;
    font-family: var(--font-body); text-align: left; color: var(--text);
    transition: border-color .15s, background .15s;
  }
  .menu-btn:hover { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 6%,var(--surface)); }
  .menu-btn-icon { font-family: var(--font-display); font-size: 22px; color: var(--accent); width: 32px; text-align: center; flex-shrink: 0; line-height: 1; }
  .menu-btn-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .menu-btn-title { font-family: var(--font-display); font-size: 18px; letter-spacing: .04em; color: var(--text); }
  .menu-btn-sub { font-size: 12px; color: var(--muted); }

  .how { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 16px 20px; margin-top: 6px; }
  .how-title { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .how ul { list-style: none; display: flex; flex-direction: column; gap: 9px; }
  .how li { font-size: 13px; color: var(--text-muted); line-height: 1.5; padding-left: 16px; position: relative; }
  .how li::before { content: '›'; position: absolute; left: 0; color: var(--accent); font-weight: 700; }
  .how strong { color: var(--text); font-weight: 600; }

  @media (max-width: 640px) { .start-header h1 { font-size: 72px; } }
</style>
