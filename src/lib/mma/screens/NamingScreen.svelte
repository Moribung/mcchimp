<!-- src/lib/mma/screens/NamingScreen.svelte -->
<script>

  import { state as gs }                 from '$lib/mma/state.svelte.js';
  import { buildDivision, divisionSlotToOpponent } from '$lib/mma/fighters.js';
  import { assignDivisionQuestions, ensureQPool } from '$lib/mma/questions.js';
  import {
    PHASES, FIGHT_STYLES, getFightStyle,
    SELECTABLE_KO, SELECTABLE_TKO, SELECTABLE_SUB,
  } from '$lib/mma/constants.js';
  import { REGIONS, REGIONAL_PROMOTIONS, REGIONAL_PROMOTION_IDS, REGIONAL_FC_DIST } from '$lib/mma/regions.js';
  import { isAdvanceKey } from '$lib/uiKeys.js';
  import { COUNTRY_OPTIONS, COUNTRY_BY_NAME, flagFor, countryName } from '$lib/mma/countries.js';
  import { pickEthnicGroup, pickFighterName } from '$lib/mma/names.js';
  import { nationalityFit } from '$lib/avatar/nationalityFits.js';
  import {
    HAIR_STYLES, BEARD_STYLES, ORGS,
    SKIN_TONES, HAIR_COLORS, SHORTS_COLORS,
  } from '$lib/avatar/fighterRenderer.js';
  import { ethnicAvatar } from '$lib/avatar/ethnicLooks.js';
  import FighterAvatar from '$lib/avatar/FighterAvatar.svelte';

  const { onsave } = $props();

  // ── Parse existing fighter name back into fields ──────
  // Prevents the name being cleared if the component re-mounts.
  function parseCareerName() {
    const name = gs.career?.fighterName || '';
    if (!name) return ['', '', ''];
    const withNick = name.match(/^(.+?) "(.+)" (.+)$/);
    if (withNick) return [withNick[1], withNick[2], withNick[3]];
    const idx = name.indexOf(' ');
    if (idx > -1) return [name.slice(0, idx), '', name.slice(idx + 1)];
    return [name, '', ''];
  }
  const [fn0, nn0, ln0] = parseCareerName();

  // ── Form fields ───────────────────────────────────────────
  let first = $state(fn0);
  let nick  = $state(nn0);
  let last  = $state(ln0);

  // ── Fight style + signature moves ─────────────────────
  let styleId   = $state('allrounder');
  let moveSlots = $state([]);

  // ── Origin ────────────────────────────────────────────
  let city                = $state('');
  let selectedCountryName = $state(gs.career?.playerNat ? (countryName(gs.career.playerNat) || 'Unknown') : 'Unknown');
  let selectedPromoId     = $state('');
  let selectedPromoName   = $state('');
  let promoOverridden     = $state(false);

  // ── Popups ────────────────────────────────────────────
  let styleModalOpen  = $state(false);
  let movesModalOpen  = $state(false);
  let promoModalOpen  = $state(false);
  let creatorOpen     = $state(false);

  function effectiveRegionId() {
    if (selectedPromoId) return REGIONAL_PROMOTIONS[selectedPromoId].regionId;
    return COUNTRY_BY_NAME[selectedCountryName]?.regionId || '';
  }

  // ── Avatar helpers ────────────────────────────────────
  // Generate an ethnicity-based look from a country name.
  function buildLookFromCountry(countryNameStr) {
    const country = COUNTRY_BY_NAME[countryNameStr];
    const iso     = country?.iso || '';
    const rid     = country?.regionId || '';
    const dist    = rid ? REGIONS[rid]?.ethnicDistribution : null;
    const group   = pickEthnicGroup(dist);
    const look    = ethnicAvatar(group, Math.random().toString(36).slice(2));
    const fit     = nationalityFit(iso, 0);
    return {
      skinIdx:       look.skinIdx,
      hairStyle:     look.hairStyle,
      hairColorIdx:  look.hairColorIdx,
      beardStyle:    look.beardStyle,
      beardColorIdx: look.beardColorIdx,
      org:           gs.career?.avatar?.org ?? 'gfl',
      shortsBase:    fit.main || '#181820',
      shortsTrim:    fit.trim || '#e8e8ec',
    };
  }

  // ── Character creator state ───────────────────────────
  // Generate a fresh random look on every new naming session.
  // svelte-ignore state_referenced_locally -- intentional: seed the look from
  // the country's initial value only; later changes are handled in pickCountry.
  const _init = buildLookFromCountry(selectedCountryName);
  let c = $state({
    skinIdx:       _init.skinIdx,
    hairStyle:     _init.hairStyle,
    hairColorIdx:  _init.hairColorIdx,
    beardStyle:    _init.beardStyle,
    beardColorIdx: _init.beardColorIdx,
    org:           _init.org,
    shortsBase:    _init.shortsBase,
    shortsTrim:    _init.shortsTrim,
  });

  // ── Shorts fit mode ───────────────────────────────────
  // 'national1' | 'national2' | 'custom'
  // Custom colors are stored separately so switching to a national fit and
  // back to custom restores whatever the player had picked.
  let fitsMode   = $state('national1');
  let customBase = $state(_init.shortsBase);
  let customTrim = $state(_init.shortsTrim);

  // Live-sync creator config to career.avatar.
  $effect(() => {
    if (!gs.career) return;
    gs.career.avatar = {
      skinIdx:       c.skinIdx,
      hairStyle:     c.hairStyle,
      hairColorIdx:  c.hairColorIdx,
      beardStyle:    c.beardStyle,
      beardColorIdx: c.beardColorIdx,
      org:           c.org,
      customBase:    c.shortsBase,
      customTrim:    c.shortsTrim,
      shortsBase:    c.shortsBase,
      shortsTrim:    c.shortsTrim,
      pantsChoice:   'custom',
    };
  });

  function applyFit(which) {
    const iso = COUNTRY_BY_NAME[selectedCountryName]?.iso || '';
    const fit = nationalityFit(iso, which);
    c.shortsBase = fit.main;
    c.shortsTrim = fit.trim;
    fitsMode = which === 0 ? 'national1' : 'national2';
  }

  function applyCustomFit() {
    c.shortsBase = customBase;
    c.shortsTrim = customTrim;
    fitsMode = 'custom';
  }

  function openCreator()  { creatorOpen = true;  }
  function closeCreator() { creatorOpen = false; }

  // ── Country change: auto-generate ethnic look ──────────
  function onCountryChange(name) {
    selectedCountryName = name;
    const iso = COUNTRY_BY_NAME[name]?.iso || '';
    if (gs.career) gs.career.playerNat = iso;

    const look = buildLookFromCountry(name);
    c.skinIdx       = look.skinIdx;
    c.hairStyle     = look.hairStyle;
    c.hairColorIdx  = look.hairColorIdx;
    c.beardStyle    = look.beardStyle;
    c.beardColorIdx = look.beardColorIdx;
    c.shortsBase    = look.shortsBase;
    c.shortsTrim    = look.shortsTrim;
    fitsMode        = 'national1';

    if (!promoOverridden) {
      const suggested = COUNTRY_BY_NAME[name]?.regionId;
      const pid = suggested ? REGIONS[suggested].promotionId : '';
      selectedPromoId   = pid;
      selectedPromoName = pid ? REGIONAL_PROMOTIONS[pid].name : '';
    }
  }

  function pickPromotion(pid) {
    selectedPromoId   = pid;
    selectedPromoName = REGIONAL_PROMOTIONS[pid].name;
    promoOverridden   = true;
    promoModalOpen    = false;
  }

  const MOVE_GROUPS = [
    { label: 'Knockouts',    moves: SELECTABLE_KO  },
    { label: 'Stoppages',    moves: SELECTABLE_TKO },
    { label: 'Submissions',  moves: SELECTABLE_SUB },
  ];

  const selectedStyle = $derived(getFightStyle(styleId));
  const selectedMoves = $derived(
    [...new Set(moveSlots)].map(m => ({ move: m, count: moveSlots.filter(x => x === m).length }))
  );

  function moveCount(move) { return moveSlots.filter(m => m === move).length; }

  function clickMove(move) {
    if (moveCount(move) === 2) { moveSlots = moveSlots.filter(m => m !== move); return; }
    moveSlots = [...moveSlots, move].slice(-2);
  }

  function clearMoves() { moveSlots = []; }

  function pickStyle(id) { styleId = id; styleModalOpen = false; }

  const canConfirm = $derived(
    first.trim().length > 0 && last.trim().length > 0 && styleId.length > 0
  );

  function confirm() {
    if (!canConfirm) return;
    const f    = first.trim();
    const n    = nick.trim();
    const l    = last.trim();
    const name = n ? `${f} "${n}" ${l}` : `${f} ${l}`;
    applyName(name);
  }

  function applyFightStyle() {
    const style = getFightStyle(styleId);
    if (!style) return;
    gs.methodWeights      = { ...style.win };
    gs.career.fightStyle  = style.id;
    gs.career.lossWeights = { ...style.loss };
    const counts = {};
    for (const m of moveSlots) counts[m] = (counts[m] || 0) + 1;
    gs.specificMethodCounts = counts;
  }

  function applyName(name) {
    if (!gs.career) return;
    const cc  = COUNTRY_BY_NAME[selectedCountryName];
    const rid = effectiveRegionId();
    const isUnknown = !cc || cc.iso === '';
    gs.career.fighterName       = name;
    gs.career.fightingOutOf     = city.trim() && selectedCountryName && !isUnknown
      ? `${city.trim()}, ${selectedCountryName}`
      : (city.trim() || '');
    gs.career.regionId          = rid;
    gs.career.phase1OrgName     = selectedPromoName || 'Regional FC';
    gs.career.playerNat         = cc?.iso || '';
    gs.career.playerFlag        = flagFor(cc);
    gs.career.playerNationality = cc?.iso ? countryName(cc.iso) : '';
    applyFightStyle();
    const dist = rid ? REGIONS[rid]?.ethnicDistribution : REGIONAL_FC_DIST;
    const newDiv = buildDivision(PHASES[1], name, dist);
    gs.career.divisions = gs.career.divisions || {};
    gs.career.divisions[1] = newDiv;
    gs.career.division    = newDiv;
    gs._qPool = null; gs._qUsed = null; gs._qById = null;
    ensureQPool(gs);
    assignDivisionQuestions(gs, newDiv, 1);
    const initFid = newDiv.slots[1];
    gs.currentOpponent = (initFid && initFid !== 'player')
      ? divisionSlotToOpponent(initFid, 1, gs.career)
      : null;
    onsave?.();
    gs.screen = 'prefight';
  }

  function generateRandom() {
    const rid  = effectiveRegionId();
    const dist = rid ? REGIONS[rid]?.ethnicDistribution : null;
    const { fn, ln, nick: rn } = pickFighterName(pickEthnicGroup(dist));
    first = fn;
    last  = ln;
    nick  = rn || '';
  }

  function toMenu() { gs.screen = 'menu'; }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (creatorOpen)  { creatorOpen = false; return; }
      if (styleModalOpen || movesModalOpen || promoModalOpen) {
        styleModalOpen = false; movesModalOpen = false; promoModalOpen = false;
      }
      return;
    }
    if (isAdvanceKey(e) && canConfirm && !styleModalOpen && !movesModalOpen && !promoModalOpen && !creatorOpen) { e.preventDefault(); confirm(); }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="naming-wrap">
  <button class="back-link" onclick={toMenu}>← Main Menu</button>

  <h2 class="naming-headline">Name Your<br>Fighter</h2>
  <p class="naming-sub">Who are you stepping into the cage as?</p>

  <!-- ── Clickable fighter preview card ──────────────── -->
  <button class="fighter-card" type="button" onclick={openCreator}>
    <div class="fighter-card-portrait">
      <FighterAvatar avatar={gs.career?.avatar} size={110} />
    </div>
  </button>

  <!-- ── Name preview in golden letters ─────────────── -->
  <div class="naming-preview">
    {#if first.trim() || last.trim()}
      <span class="preview-first">{first.trim() || '…'}</span>
      {#if nick.trim()}
        <span class="preview-nick">"{nick.trim()}"</span>
      {/if}
      <span class="preview-last">{last.trim() || '…'}</span>
    {:else}
      —
    {/if}
  </div>

  <div class="naming-row">
    <div class="naming-field">
      <label class="naming-label" for="naming-first">First Name</label>
      <input
        class="naming-input"
        id="naming-first"
        bind:value={first}
        placeholder="e.g. Jake"
        maxlength="20"
        autocomplete="off"
      />
    </div>
    <div class="naming-field">
      <label class="naming-label" for="naming-nick">
        Nickname <span class="optional">(optional)</span>
      </label>
      <input
        class="naming-input naming-nick"
        id="naming-nick"
        bind:value={nick}
        placeholder={`e.g. "The Hammer"`}
        maxlength="24"
        autocomplete="off"
      />
    </div>
    <div class="naming-field">
      <label class="naming-label" for="naming-last">Last Name</label>
      <input
        class="naming-input"
        id="naming-last"
        bind:value={last}
        placeholder="e.g. Torres"
        maxlength="20"
        autocomplete="off"
      />
    </div>
  </div>

  <!-- ── Fighting out of ──────────────────────────────── -->
  <div class="naming-row">
    <div class="naming-field">
      <label class="naming-label" for="naming-city">
        City <span class="optional">(optional)</span>
      </label>
      <input
        class="naming-input"
        id="naming-city"
        bind:value={city}
        placeholder="e.g. Houston"
        maxlength="32"
        autocomplete="off"
      />
    </div>
    <div class="naming-field">
      <label class="naming-label" for="naming-country">
        Country <span class="optional">(optional)</span>
      </label>
      <select
        class="naming-input"
        id="naming-country"
        value={selectedCountryName}
        onchange={(e) => onCountryChange(e.currentTarget.value)}
      >
        {#each COUNTRY_OPTIONS as co}
          <option value={co.name}>{flagFor(co)} {co.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- ── Primary actions ──────────────────────────────── -->
  <div class="btn-row">
    <button class="btn btn-primary" disabled={!canConfirm} onclick={confirm}>
      Enter the Cage
    </button>
    <button class="btn btn-ghost" onclick={generateRandom}>
      Randomize Name
    </button>
  </div>
  {#if !styleId}
    <p class="confirm-hint">Pick a fighting style below before you can enter the cage.</p>
  {/if}

  <!-- ── Fighting style ───────────────────────────────── -->
  <div class="section-head">Fighting Style</div>
  {#if selectedStyle}
    <button type="button" class="selector selected" onclick={() => (styleModalOpen = true)}>
      <span class="selector-main">
        <span class="style-name">{selectedStyle.name}</span>
        <span class="style-tag">{selectedStyle.tagline}</span>
      </span>
      <span class="selector-edit">Change</span>
    </button>
  {:else}
    <button type="button" class="selector selector-empty" onclick={() => (styleModalOpen = true)}>
      <span>Choose Your Style</span>
      <span class="selector-edit">Select →</span>
    </button>
  {/if}

  <!-- ── Starting promotion ───────────────────────────── -->
  <div class="section-head">
    Starting Promotion <span class="optional">(optional)</span>
  </div>
  {#if selectedPromoName}
    <button type="button" class="selector selected" onclick={() => (promoModalOpen = true)}>
      <span class="selector-main">
        <span class="style-name">{selectedPromoName}</span>
        <span class="style-tag">{REGIONAL_PROMOTIONS[selectedPromoId]?.tagline || ''}</span>
      </span>
      <span class="selector-edit">Change</span>
    </button>
  {:else}
    <button type="button" class="selector selector-empty" onclick={() => (promoModalOpen = true)}>
      <span>Choose Your Promotion</span>
      <span class="selector-edit">Select →</span>
    </button>
  {/if}

  <!-- ── Signature moves ──────────────────────────────── -->
  <div class="section-head">
    Signature Moves <span class="optional">(optional)</span>
  </div>
  {#if selectedMoves.length}
    <button type="button" class="selector selector-moves" onclick={() => (movesModalOpen = true)}>
      <span class="selected-moves">
        {#each selectedMoves as sm}
          <span class="move-chip" class:single={sm.count === 1} class:double={sm.count === 2}>
            {sm.move}{#if sm.count === 2}<span class="x2"> ×2</span>{/if}
          </span>
        {/each}
      </span>
      <span class="selector-edit">Edit</span>
    </button>
  {:else}
    <button type="button" class="selector selector-empty" onclick={() => (movesModalOpen = true)}>
      <span>Add Signature Moves</span>
      <span class="selector-edit">Select →</span>
    </button>
  {/if}
</div>

<!-- ── Style picker modal ─────────────────────────────── -->
{#if styleModalOpen}
  <div class="modal-overlay" role="presentation" onclick={() => (styleModalOpen = false)}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3 class="modal-title">Choose Your Style</h3>
        <button type="button" class="modal-close" aria-label="Close" onclick={() => (styleModalOpen = false)}>✕</button>
      </div>
      <div class="style-grid">
        {#each FIGHT_STYLES as s}
          <button
            type="button"
            class="style-card"
            class:selected={styleId === s.id}
            onclick={() => pickStyle(s.id)}
          >
            <span class="style-name">{s.name}</span>
            <span class="style-tag">{s.tagline}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- ── Starting promotion modal ───────────────────────── -->
{#if promoModalOpen}
  <div class="modal-overlay" role="presentation" onclick={() => (promoModalOpen = false)}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3 class="modal-title">Starting Promotion</h3>
        <button type="button" class="modal-close" aria-label="Close" onclick={() => (promoModalOpen = false)}>✕</button>
      </div>
      <div class="style-grid">
        {#each REGIONAL_PROMOTION_IDS as pid}
          {@const promo = REGIONAL_PROMOTIONS[pid]}
          <button
            type="button"
            class="style-card"
            class:selected={selectedPromoId === pid}
            onclick={() => pickPromotion(pid)}
          >
            <span class="style-name">{promo.name}</span>
            <span class="style-tag">{promo.tagline}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- ── Signature moves modal ──────────────────────────── -->
{#if movesModalOpen}
  <div class="modal-overlay" role="presentation" onclick={() => (movesModalOpen = false)}>
    <div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3 class="modal-title">Signature Moves</h3>
        <button type="button" class="modal-close" aria-label="Close" onclick={() => (movesModalOpen = false)}>✕</button>
      </div>
      <p class="moves-hint">
        Tap a move to favour it. Tap it twice to commit hard. Your last two picks stick.
      </p>
      {#each MOVE_GROUPS as group}
        <div class="move-group">
          <div class="move-group-label">{group.label}</div>
          <div class="move-chips">
            {#each group.moves as move}
              {@const cnt = moveCount(move)}
              <button
                type="button"
                class="move-chip"
                class:single={cnt === 1}
                class:double={cnt === 2}
                onclick={() => clickMove(move)}
              >
                {move}
              </button>
            {/each}
          </div>
        </div>
      {/each}
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" disabled={!moveSlots.length} onclick={clearMoves}>
          Clear Moves
        </button>
        <button type="button" class="btn btn-primary" onclick={() => (movesModalOpen = false)}>
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Character creator modal ────────────────────────── -->
{#if creatorOpen}
  <div class="modal-overlay" role="presentation" onclick={closeCreator}>
    <div class="modal creator-modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="modal-head">
        <h3 class="modal-title">Character Creator</h3>
        <button type="button" class="modal-close" aria-label="Close" onclick={closeCreator}>✕</button>
      </div>

      <div class="creator-body">
        <!-- Left: live fighter preview -->
        <div class="creator-left">
          <div class="creator-stage">
            <FighterAvatar avatar={gs.career?.avatar} size={160} />
          </div>
          <div class="cr-nat-row">
            <button type="button" class="cr-fit-btn" class:cr-fit-active={fitsMode === 'national1'} onclick={() => applyFit(0)}>National Fit 1</button>
            <button type="button" class="cr-fit-btn" class:cr-fit-active={fitsMode === 'national2'} onclick={() => applyFit(1)}>National Fit 2</button>
            <button type="button" class="cr-fit-btn" class:cr-fit-active={fitsMode === 'custom'} onclick={applyCustomFit}>Select Custom Style</button>
          </div>
        </div>

        <!-- Right: controls -->
        <div class="creator-right">

          <div class="cr-ctrl">
            <span class="cr-label">Skin</span>
            <div class="cr-btns">
              {#each SKIN_TONES as tone, i}
                <button class="cr-swatch" style="background:{tone.base}" class:sel={c.skinIdx === i}
                  aria-label={tone.label} onclick={() => c.skinIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cr-ctrl">
            <span class="cr-label">Hair</span>
            <div class="cr-btns">
              {#each HAIR_STYLES as h}
                <button class="cr-btn" class:sel={c.hairStyle === h} onclick={() => c.hairStyle = h}>{h}</button>
              {/each}
            </div>
          </div>

          <div class="cr-ctrl">
            <span class="cr-label">Hair color</span>
            <div class="cr-btns">
              {#each HAIR_COLORS as col, i}
                <button class="cr-swatch" style="background:{col.hex}" class:sel={c.hairColorIdx === i}
                  aria-label={col.label} onclick={() => c.hairColorIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cr-ctrl">
            <span class="cr-label">Beard</span>
            <div class="cr-btns">
              {#each BEARD_STYLES as b}
                <button class="cr-btn" class:sel={c.beardStyle === b} onclick={() => c.beardStyle = b}>{b}</button>
              {/each}
            </div>
          </div>

          <div class="cr-ctrl">
            <span class="cr-label">Beard color</span>
            <div class="cr-btns">
              {#each HAIR_COLORS as col, i}
                <button class="cr-swatch" style="background:{col.hex}" class:sel={c.beardColorIdx === i}
                  disabled={c.beardStyle === 'none'} aria-label={col.label}
                  onclick={() => c.beardColorIdx = i}></button>
              {/each}
            </div>
          </div>

          <div class="cr-ctrl">
            <span class="cr-label">Shorts pattern</span>
            <div class="cr-btns">
              {#each Object.entries(ORGS) as [id, lbl]}
                <button class="cr-btn" class:sel={c.org === id} onclick={() => c.org = id}>{lbl}</button>
              {/each}
            </div>
          </div>

          {#if fitsMode === 'custom'}
            <div class="cr-ctrl">
              <span class="cr-label">Shorts base</span>
              <div class="cr-btns">
                {#each SHORTS_COLORS as col}
                  <button class="cr-swatch" style="background:{col.hex}" class:sel={c.shortsBase === col.hex}
                    aria-label={col.label} onclick={() => { c.shortsBase = col.hex; customBase = col.hex; }}></button>
                {/each}
              </div>
            </div>

            <div class="cr-ctrl">
              <span class="cr-label">Shorts trim</span>
              <div class="cr-btns">
                {#each SHORTS_COLORS as col}
                  <button class="cr-swatch" style="background:{col.hex}" class:sel={c.shortsTrim === col.hex}
                    aria-label={col.label} onclick={() => { c.shortsTrim = col.hex; customTrim = col.hex; }}></button>
                {/each}
              </div>
            </div>
          {/if}

        </div>
      </div>

      <div class="modal-foot">
        <button type="button" class="btn btn-primary" onclick={closeCreator}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .naming-wrap {
    max-width: 600px;
    margin: 0 auto;
    padding: 28px 0 40px;
  }

  .back-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0;
    margin-bottom: 18px;
    transition: color 0.15s;
  }
  .back-link:hover { color: var(--accent); }

  .naming-headline {
    font-family: var(--font-display);
    font-size: 38px;
    letter-spacing: 0.03em;
    line-height: 1.1;
    margin-bottom: 6px;
  }

  .naming-sub {
    color: var(--text-muted);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  /* ── Fighter preview card ─────────────────────────── */
  .fighter-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 150px;
    height: 150px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    margin-bottom: 20px;
  }
  .fighter-card:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--surface2));
  }
  .fighter-card-portrait {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* ── Name preview (golden letters) ───────────────── */
  .naming-preview {
    font-family: var(--font-display);
    font-size: 22px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    margin-bottom: 20px;
    min-height: 1.4em;
  }
  .preview-first, .preview-last { color: var(--accent); }
  .preview-nick { color: var(--accent); font-style: italic; }

  .naming-row {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .naming-field { flex: 1; min-width: 120px; }

  .naming-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 5px;
    display: block;
  }
  .optional { opacity: 0.5; }

  .naming-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    padding: 11px 14px;
    transition: border-color 0.15s;
    outline: none;
  }
  .naming-input:focus { border-color: var(--accent); }
  .naming-input::placeholder { color: var(--text-muted); opacity: 0.6; }
  .naming-nick { font-style: italic; }

  .btn-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 6px;
    align-items: center;
  }

  .confirm-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }

  /* ── Section heads ────────────────────────────────── */
  .section-head {
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 24px 0 10px;
  }

  /* ── Selector boxes ───────────────────────────────── */
  .selector {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    text-align: left;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .selector:hover { border-color: var(--accent); }
  .selector-empty { color: var(--text-muted); }
  .selector-main { display: flex; flex-direction: column; gap: 4px; }
  .selector-edit {
    flex-shrink: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .selector.selected { border-color: var(--accent); }
  .selector-moves { padding: 10px 14px; }
  .selected-moves { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

  /* ── Fight style cards ────────────────────────────── */
  .style-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .style-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 11px 13px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .style-card:hover { border-color: var(--accent); }
  .style-card.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface2));
  }
  .style-name {
    font-family: var(--font-display);
    font-size: 15px;
    letter-spacing: 0.03em;
    color: var(--text);
  }
  .style-card.selected .style-name,
  .selector.selected .style-name { color: var(--accent); }
  .style-tag {
    font-size: 11px;
    line-height: 1.3;
    color: var(--text-muted);
  }

  /* ── Move chips ───────────────────────────────────── */
  .moves-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0 0 16px;
    line-height: 1.4;
  }
  .move-group { margin-bottom: 12px; }
  .move-group-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .move-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .move-chip {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .move-chip:hover { border-color: var(--accent); color: var(--text); }
  .move-chip.single {
    border-color: var(--accent);
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface2));
  }
  .move-chip.double {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 24%, var(--surface2));
    box-shadow: 0 0 0 1px var(--accent), 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent);
    font-weight: 700;
  }
  .selected-moves .move-chip { cursor: default; }
  .x2 { opacity: 0.8; font-weight: 700; }

  /* ── Modals ───────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.66);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
  }
  .modal {
    width: 100%;
    max-width: 560px;
    max-height: 86vh;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 22px 22px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .modal-title {
    font-family: var(--font-display);
    font-size: 20px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.15s;
  }
  .modal-close:hover { color: var(--accent); }
  .modal-foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  /* ── Character creator modal ──────────────────────── */
  .creator-modal { max-width: 660px; }

  .creator-body {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .creator-left {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 0;
  }

  .creator-stage {
    background: color-mix(in srgb, var(--accent) 5%, var(--surface2));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px 20px 10px;
    display: flex;
    justify-content: center;
  }

  .cr-nat-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .cr-fit-btn {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 7px 10px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .cr-fit-btn:hover { border-color: var(--accent); color: var(--accent); }
  .cr-fit-active {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface2));
  }

  .creator-right { flex: 1; min-width: 0; }

  .cr-ctrl { margin-bottom: 12px; }
  .cr-label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .cr-btns { display: flex; gap: 5px; flex-wrap: wrap; }

  .cr-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 5px 10px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .cr-btn:hover { border-color: var(--accent); color: var(--text); }
  .cr-btn.sel {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface2));
  }

  .cr-swatch {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 5px;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: box-shadow 0.12s;
  }
  .cr-swatch.sel { box-shadow: 0 0 0 2px var(--text); }
  .cr-swatch:disabled { opacity: 0.3; cursor: not-allowed; }

  @media (max-width: 500px) {
    .creator-body { flex-direction: column; }
    .creator-left { position: static; width: 100%; }
  }
</style>
