// Single source of truth for AI-generator tier access & credits.
// Used by the questions layout, the create page, and the /api/generate endpoint.

// Tiers that can use the AI generator. (Add 'regular' here to open it up further.)
export const AI_ACCESS_TIERS = ['pro', 'max', 'dev', 'admin'];

// Tiers that additionally see platform-wide limits and token counts.
export const AI_ELEVATED_TIERS = ['dev', 'admin'];

// Default monthly credit allotment per tier. A non-null profiles.ai_monthly_credits
// overrides this for an individual user.
export const TIER_MONTHLY_CREDITS = { regular: 1, pro: 30, max: 150, dev: 1000000, admin: 30 };

export const hasAiAccess = (tier) => AI_ACCESS_TIERS.includes(tier);
export const isAiElevated = (tier) => AI_ELEVATED_TIERS.includes(tier);
export const monthlyCreditsFor = (tier, override) =>
  override ?? TIER_MONTHLY_CREDITS[tier] ?? 0;
