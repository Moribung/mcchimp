import { supabase } from '$lib/supabase';

/*
 * Required DB migrations (run in Supabase SQL editor):
 *
 * -- career_saves: drop old unique constraint, add new columns
 * ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS fighter_name text;
 * ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
 * -- Drop the unique constraint that only allowed 1 save per user+game:
 * ALTER TABLE career_saves DROP CONSTRAINT IF EXISTS career_saves_user_id_game_id_key;
 *
 * -- career_history: add new columns
 * ALTER TABLE career_history ADD COLUMN IF NOT EXISTS highest_org text;
 * ALTER TABLE career_history ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
 * ALTER TABLE career_history ADD COLUMN IF NOT EXISTS stat_breakdown jsonb;
 *
 * -- profiles: add tier column
 * ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'regular';
 */

export function getUserLimits(profile) {
  const tier = profile?.tier;
  if (tier === 'max') {
    return { maxActiveSaves: 100, maxFavouritables: 50, maxPastCareers: 100, maxFavouritablePast: 50 };
  }
  if (tier === 'pro' || tier === 'dev') {
    return { maxActiveSaves: 20, maxFavouritables: 10, maxPastCareers: 20, maxFavouritablePast: 10 };
  }
  return { maxActiveSaves: 10, maxFavouritables: 5, maxPastCareers: 10, maxFavouritablePast: 5 };
}

export async function loadAllSaves(userId, gameId) {
  const { data, error } = await supabase
    .from('career_saves')
    .select('id, fighter_name, save_data, starred, updated_at')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadSaveById(saveId) {
  const { data, error } = await supabase
    .from('career_saves')
    .select('id, save_data, starred, updated_at')
    .eq('id', saveId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function createSave(userId, gameId, saveData, fighterName) {
  const { data, error } = await supabase
    .from('career_saves')
    .insert({
      user_id: userId,
      game_id: gameId,
      fighter_name: fighterName || null,
      save_data: saveData,
      starred: false,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSave(saveId, saveData, fighterName) {
  const updates = { save_data: saveData, updated_at: new Date().toISOString() };
  if (fighterName !== undefined) updates.fighter_name = fighterName;
  const { error } = await supabase
    .from('career_saves')
    .update(updates)
    .eq('id', saveId);
  if (error) throw error;
}

export async function deleteSave(saveId) {
  const { error } = await supabase
    .from('career_saves')
    .delete()
    .eq('id', saveId);
  if (error) throw error;
}

export async function toggleSaveStar(saveId, starred) {
  const { error } = await supabase
    .from('career_saves')
    .update({ starred })
    .eq('id', saveId);
  if (error) throw error;
}

export async function loadPastCareers(userId, gameId) {
  const { data, error } = await supabase
    .from('career_history')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('ended_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function archiveCareer(userId, gameId, { fighterName, finalRecord, legacyTitle, highestOrg, statBreakdown }) {
  const { data, error } = await supabase
    .from('career_history')
    .insert({
      user_id: userId,
      game_id: gameId,
      fighter_name: fighterName,
      final_record: finalRecord,
      legacy_title: legacyTitle,
      highest_org: highestOrg || null,
      stat_breakdown: statBreakdown || null,
      starred: false,
      ended_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function toggleHistoryStar(historyId, starred) {
  const { error } = await supabase
    .from('career_history')
    .update({ starred })
    .eq('id', historyId);
  if (error) throw error;
}

export async function deleteHistory(historyId) {
  const { error } = await supabase
    .from('career_history')
    .delete()
    .eq('id', historyId);
  if (error) throw error;
}
