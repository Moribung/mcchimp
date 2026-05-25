import { supabase } from '$lib/supabase';

/**
 * Load a career save for the current user and game.
 * Returns the save_data blob or null if none exists.
 */
export async function loadSave(userId, gameId) {
  const { data, error } = await supabase
    .from('career_saves')
    .select('save_data')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .single();

  if (error || !data) return null;
  return data.save_data;
}

/**
 * Write a career save for the current user and game.
 * Upserts — creates if none exists, updates if it does.
 */
export async function exportSave(userId, gameId, saveData) {
  const { error } = await supabase
    .from('career_saves')
    .upsert({
      user_id: userId,
      game_id: gameId,
      save_data: saveData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,game_id'
    });

  if (error) throw error;
}

/**
 * Delete a career save.
 */
export async function deleteSave(userId, gameId) {
  const { error } = await supabase
    .from('career_saves')
    .delete()
    .eq('user_id', userId)
    .eq('game_id', gameId);

  if (error) throw error;
}

/**
 * Write a completed career to the permanent history table.
 */
export async function archiveCareer(userId, gameId, { fighterName, finalRecord, legacyTitle }) {
  const { error } = await supabase
    .from('career_history')
    .insert({
      user_id: userId,
      game_id: gameId,
      fighter_name: fighterName,
      final_record: finalRecord,
      legacy_title: legacyTitle,
      ended_at: new Date().toISOString()
    });

  if (error) throw error;
}