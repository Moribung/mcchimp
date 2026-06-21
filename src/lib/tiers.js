// Single source of truth for tier *presentation* — labels, ordering, and the
// perk lists shown on the account/upgrade UI.
//
// NOTE: actual access & limits live with their features, not here:
//   - AI access/credits  → src/lib/ai/access.js
//   - question set limits → src/routes/questions/library/+page.svelte (TIER_LIMITS)
//   - cloud save limits   → src/lib/saves.js + game MenuScreens
// Keep the perk copy below in sync with those numbers.

// Badge labels for every tier key that can appear on a profile.
export const TIER_LABELS = {
  regular: 'Free',
  pro: 'Pro',
  max: 'Max',
  dev: 'Developer',
  admin: 'Admin'
};

// Upgrade ladder. Only tiers a user can buy into appear here; internal tiers
// (dev/admin) are intentionally absent so the upgrade UI hides for them.
export const PLAN_RANK = { regular: 0, pro: 1, max: 2 };

// The buyable plans, in display order. `rank` matches PLAN_RANK so the UI can
// tell which plans a user already owns vs. can upgrade to.
export const PAID_PLANS = [
  {
    key: 'pro',
    label: 'Pro',
    rank: 1,
    featured: true,
    tagline: 'For regular players',
    perks: [
      '20 cloud saves per game',
      '20 question sets in your library',
      'AI question generator — 30 credits / month',
      'Publish your sets publicly'
    ]
  },
  {
    key: 'max',
    label: 'Max',
    rank: 2,
    featured: false,
    tagline: 'For power users & creators',
    perks: [
      '100 cloud saves per game',
      '100 question sets in your library',
      'AI question generator — 150 credits / month',
      'Everything in Pro, plus priority support'
    ]
  }
];

// Per-tier limits for question sets & groups. A profile's `set_limit` column
// (a per-user override) takes precedence when set; otherwise the tier default
// applies. admin is kept in line with max. Keep these in sync with the perk
// copy above and the cloud-save limits in src/lib/saves.js.
export const TIER_SET_LIMITS   = { regular: 3, pro: 20, max: 100, dev: 9999, admin: 100 };
export const TIER_GROUP_LIMITS = { regular: 3, pro: 20, max: 100, dev: 9999, admin: 100 };

// override ?? tier default ?? hard floor of 3.
export const setLimitFor   = (tier, override) => override ?? TIER_SET_LIMITS[tier] ?? 3;
export const groupLimitFor = (tier, override) => override ?? TIER_GROUP_LIMITS[tier] ?? 3;

// True when `tier` already includes (owns) the given plan. dev/admin rank as
// above everything so internal accounts never see an upgrade prompt.
export function ownsPlan(tier, planRank) {
  if (tier === 'dev' || tier === 'admin') return true;
  return (PLAN_RANK[tier] ?? 0) >= planRank;
}
