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

// True when `tier` already includes (owns) the given plan. dev/admin rank as
// above everything so internal accounts never see an upgrade prompt.
export function ownsPlan(tier, planRank) {
  if (tier === 'dev' || tier === 'admin') return true;
  return (PLAN_RANK[tier] ?? 0) >= planRank;
}
