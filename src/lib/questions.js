/**
 * Question set loader — wraps the static /questions/ registry.
 * In Phase 2 this is the only file that changes when we move to Supabase.
 */

/**
 * Fetch the list of available question set filenames.
 * @returns {Promise<string[]>}
 */
export async function fetchIndex() {
  const res = await fetch('/questions/index.json');
  if (!res.ok) throw new Error('Could not load question index.');
  return res.json();
}

/**
 * Fetch a single question set by filename.
 * @param {string} filename - e.g. 'mma_questions.json'
 * @returns {Promise<object>}
 */
export async function fetchSet(filename) {
  const res = await fetch(`/questions/${filename}`);
  if (!res.ok) throw new Error(`Could not load question set: ${filename}`);
  return res.json();
}

/**
 * Fetch all question sets listed in the index.
 * Returns an array of { filename, data } objects.
 * Failed sets return { filename, data: null }.
 * @returns {Promise<Array<{filename: string, data: object|null}>>}
 */
export async function fetchAllSets() {
  const index = await fetchIndex();
  return Promise.all(index.map(async filename => {
    try {
      const data = await fetchSet(filename);
      return { filename, data };
    } catch {
      return { filename, data: null };
    }
  }));
}