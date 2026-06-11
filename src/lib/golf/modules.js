/**
 * Question module registry helpers — registering public/library/group sets
 * into the golf game state, and re-resolving them when a save is restored.
 */

import { supabase } from '$lib/supabase.js';
import { fetchSet } from '$lib/questions.js';
import { TIER_ORDER } from './constants.js';

export function totalQs(mod) {
  return TIER_ORDER.reduce((n, t) => n + (mod.tiers?.[t] || []).length, 0);
}

export function registerModule(gs, mod) {
  if (!gs.loadedModules[mod.id]) {
    gs.availableModules = [...gs.availableModules, mod];
  }
  gs.loadedModules[mod.id] = mod;
}

export function libraryModule(item) {
  return {
    id: 'lib_' + item.id,
    tag: 'library',
    name: item.name,
    description: item.description ?? '',
    ...item.data,
  };
}

/** Merge every member set of a group into one module (id: grp_<groupId>). */
export async function buildGroupModule(group, gs) {
  const members = group.question_set_group_members || [];
  const merged  = {};
  for (const m of members) {
    let data = null;
    if (m.set_source === 'library') {
      const { data: row } = await supabase.from('user_question_sets').select('data').eq('id', m.set_id).maybeSingle();
      data = row?.data;
    } else {
      data = gs.loadedModules?.[m.set_id] || gs.loadedModules?.[m.set_id?.replace('.json', '')];
      if (!data) { try { data = await fetchSet(m.set_id.endsWith('.json') ? m.set_id : m.set_id + '.json'); } catch { /* skip */ } }
    }
    if (!data?.tiers) continue;
    for (const t of TIER_ORDER) {
      const qs = data.tiers[t] || [];
      if (!qs.length) continue;
      (merged[t] ||= []).push(...qs);
    }
  }
  return {
    id: 'grp_' + group.id, tag: 'group', name: group.name,
    description: `${members.length} set${members.length !== 1 ? 's' : ''}`,
    tiers: merged,
  };
}

/**
 * Make sure gs.activeModId points at a loaded module after a save restore.
 * Static sets are already in loadedModules; library and group modules are
 * re-fetched from Supabase. Falls back to the first default set.
 * @returns {string|null} the modId to rebuild the pool from
 */
export async function restoreActiveModule(gs) {
  const id = gs.activeModId;
  if (id && gs.loadedModules[id]) return id;

  try {
    if (id?.startsWith('lib_')) {
      const { data } = await supabase
        .from('user_question_sets')
        .select('id, name, description, data')
        .eq('id', id.slice(4))
        .maybeSingle();
      if (data?.data?.tiers) {
        registerModule(gs, libraryModule(data));
        return id;
      }
    } else if (id?.startsWith('grp_')) {
      const { data } = await supabase
        .from('question_set_groups')
        .select('*, question_set_group_members(*)')
        .eq('id', id.slice(4))
        .maybeSingle();
      if (data) {
        const mod = await buildGroupModule(data, gs);
        if (totalQs(mod) > 0) {
          registerModule(gs, mod);
          return id;
        }
      }
    }
  } catch (e) {
    console.warn('[golf] could not restore question module', id, e?.message);
  }

  const fallback = gs.availableModules.find(m => !m.tag);
  return fallback?.id ?? null;
}
