<!-- src/lib/mma/screens/CareerEndScreen.svelte -->
<!-- Retirement / cut / strip screen — shown for career_end state -->
<!-- In the Svelte recode this screen is handled inline in ResultScreen via the -->
<!-- career choice modal, so this component is a thin pass-through that redirects. -->
<!-- It exists so the screen router in +page.svelte has a target if needed. -->
<script>
  import { onMount } from 'svelte';
  import { state as gs } from '$lib/mma/state.svelte.js';

  const { oncareerend } = $props();
  onMount(async () => {
    // oncareerend handles routing (past_careers for logged-in, 'end' otherwise)
    await oncareerend?.();
  });
</script>
<!-- Nothing to render — redirects immediately in onMount -->
