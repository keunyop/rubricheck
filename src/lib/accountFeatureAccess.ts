export const ACCOUNT_FEATURE_TIERS = ["free", "topup", "pro"] as const;

export type AccountFeatureTier = (typeof ACCOUNT_FEATURE_TIERS)[number];

type SubscriptionPlan = "free" | "pro" | null | undefined;
type BillingSource = "free" | "pro" | "credit" | null | undefined;

function normalizeCreditsBalance(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function resolveAccountFeatureTier(params: {
  plan?: SubscriptionPlan;
  creditsBalance?: number | null;
  billingSource?: BillingSource;
}): AccountFeatureTier {
  if (params.plan === "pro" || params.billingSource === "pro") {
    return "pro";
  }

  if (params.billingSource === "credit" || normalizeCreditsBalance(params.creditsBalance) > 0) {
    return "topup";
  }

  return "free";
}

export function canUseStrictMode(tier: AccountFeatureTier): boolean {
  return tier !== "free";
}

export function canAccessDetailedFeedback(tier: AccountFeatureTier): boolean {
  return tier !== "free";
}

export function canAccessRewriteSuggestions(tier: AccountFeatureTier): boolean {
  return tier === "pro";
}

export function getVisibleTopImprovementsCount(tier: AccountFeatureTier): number {
  return tier === "free" ? 1 : 3;
}
