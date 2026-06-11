/**
 * McChimp Question Set Validator v2.0
 * Validates a question set object against the v2 schema.
 * Used by the generator (download) and library (upload).
 *
 * @param {object} data - Parsed question set JSON
 * @returns {string[]} Array of issue strings. Empty = valid.
 */
export function validateQuestionSet(data) {
  const issues = [];

  // ── TOP LEVEL ──
  if (!data || typeof data !== 'object') {
    issues.push('File is not a valid JSON object.');
    return issues;
  }
  if (!data.name?.trim()) {
    issues.push('Set name is required.');
  }
  if (!data.tiers || typeof data.tiers !== 'object') {
    issues.push('Set must have a "tiers" object.');
    return issues;
  }

  const VALID_TIERS = ['easy', 'medium', 'hard', 'elite'];
  const VALID_TYPES = ['multi_select', 'multiple_choice', 'true_false', 'typed', 'fill_gap', 'ordered', 'image'];
  const SOON_TYPES  = ['ordered', 'image'];

  let totalQuestions = 0;

  for (const tier of VALID_TIERS) {
    const qs = data.tiers[tier];
    if (!qs) continue;

    if (!Array.isArray(qs)) {
      issues.push(`Tier "${tier}" must be an array.`);
      continue;
    }

    totalQuestions += qs.length;

    qs.forEach((q, i) => {
      const label = `${tier} Q${i + 1}${q.id ? ` (${q.id})` : ''}`;
      const type = q.type || 'multi_select';

      // Unknown type
      if (!VALID_TYPES.includes(type)) {
        issues.push(`${label}: unknown type "${type}".`);
        return;
      }

      // Coming soon types — warn but don't block
      if (SOON_TYPES.includes(type)) {
        issues.push(`${label}: type "${type}" is not yet supported by the renderer and will be skipped.`);
        return;
      }

      // ── TYPE-SPECIFIC VALIDATION ──

      if (type === 'multi_select' || type === 'multiple_choice') {
        if (!q.question?.trim()) issues.push(`${label}: question text is required.`);
        if (!Array.isArray(q.options) || q.options.filter(o => o?.trim()).length < 2) {
          issues.push(`${label}: at least 2 options are required.`);
        } else {
          const opts = q.options.map(o => String(o ?? '').trim().toLowerCase()).filter(Boolean);
          if (new Set(opts).size !== opts.length) {
            issues.push(`${label}: options must be distinct (duplicate option text).`);
          }
        }
        if (!Array.isArray(q.answers) || q.answers.length === 0) {
          issues.push(`${label}: at least one correct answer is required.`);
        } else {
          if (type === 'multiple_choice' && q.answers.length > 1) {
            issues.push(`${label}: multiple_choice must have exactly one answer.`);
          }
          if (new Set(q.answers).size !== q.answers.length) {
            issues.push(`${label}: duplicate answer indices.`);
          }
          for (const ai of q.answers) {
            if (typeof ai !== 'number' || !q.options?.[ai]?.trim()) {
              issues.push(`${label}: answer index ${ai} does not match a valid option.`);
            }
          }
        }
      }

      else if (type === 'true_false') {
        if (!q.question?.trim()) issues.push(`${label}: question text is required.`);
        if (!Array.isArray(q.answers) || q.answers.length !== 1) {
          issues.push(`${label}: true_false must have exactly one answer — [0] for True, [1] for False.`);
        } else if (![0, 1].includes(q.answers[0])) {
          issues.push(`${label}: true_false answer must be 0 (True) or 1 (False).`);
        }
      }

      else if (type === 'typed') {
        if (!q.question?.trim()) issues.push(`${label}: question text is required.`);
        const cleaned = (Array.isArray(q.answers) ? q.answers : [])
          .map(a => String(a ?? '').trim().toLowerCase())
          .filter(Boolean);
        const distinct = new Set(cleaned).size;
        if (distinct === 0) {
          issues.push(`${label}: typed questions need at least one non-empty accepted answer.`);
        } else {
          if (q.required_count !== undefined && (typeof q.required_count !== 'number' || q.required_count < 1)) {
            issues.push(`${label}: required_count must be a positive number.`);
          }
          // The engine asks for (required_count ?? answers.length) inputs; it is
          // unsatisfiable if that exceeds the number of DISTINCT accepted answers
          // (entries differing only in case/spacing collapse to one).
          const effRequired = q.required_count ?? (Array.isArray(q.answers) ? q.answers.length : 0);
          if (effRequired > distinct) {
            issues.push(`${label}: asks for ${effRequired} answer(s) but only ${distinct} distinct accepted answer(s).`);
          }
        }
        if (q.tolerance !== undefined && (typeof q.tolerance !== 'number' || q.tolerance < 0)) {
          issues.push(`${label}: tolerance must be a non-negative number.`);
        }
      }

      else if (type === 'fill_gap') {
        if (!q.template?.trim()) issues.push(`${label}: fill_gap requires a "template" field.`);
        else {
          const gapCount = (q.template.match(/___/g) || []).length;
          if (gapCount === 0) {
            issues.push(`${label}: template has no ___ placeholders.`);
          } else if (!Array.isArray(q.answers)) {
            issues.push(`${label}: fill_gap requires an "answers" array.`);
          } else if (q.answers.length !== gapCount) {
            issues.push(`${label}: template has ${gapCount} gap(s) but answers has ${q.answers.length} entry(s). They must match.`);
          }
        }
      }
    });
  }

  if (totalQuestions === 0) {
    issues.push('Add at least one question before saving.');
  }

  return issues;
}

/**
 * Quick check — returns true if the set is valid, false if not.
 * @param {object} data
 * @returns {boolean}
 */
export function isValidQuestionSet(data) {
  return validateQuestionSet(data).length === 0;
}
