<script>
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      goto('/account');
    } else {
      goto('/auth/login');
    }
  });
</script>

<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <p style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;font-size:13px;">
    Signing you in…
  </p>
</div>