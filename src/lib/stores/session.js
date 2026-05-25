import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';

export const session = writable(null);

// Initialize session from Supabase on app load
supabase.auth.getSession().then(({ data }) => {
  session.set(data.session);
});

// Keep session in sync with Supabase auth state changes
supabase.auth.onAuthStateChange((_event, newSession) => {
  session.set(newSession);
});