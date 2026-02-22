export const PRO_MONTHLY_LOOKUP_KEY = "pro_monthly";
export const PRO_ANNUAL_LOOKUP_KEY = "pro_annual";

export const PRO_CHECKOUT_PLANS = ["monthly", "annual"] as const;

export type ProCheckoutPlan = (typeof PRO_CHECKOUT_PLANS)[number];
export type ProPriceLookupKey = typeof PRO_MONTHLY_LOOKUP_KEY | typeof PRO_ANNUAL_LOOKUP_KEY;

export const PRO_CHECKOUT_DISPLAY: Record<
  ProCheckoutPlan,
  {
    price: string;
    periodLabel: string;
    saveNote?: string;
  }
> = {
  monthly: {
    price: "$9.99",
    periodLabel: "/month",
  },
  annual: {
    price: "$79.99",
    periodLabel: "/year",
    saveNote: "Save ~33% vs monthly",
  },
};

const PLAN_TO_LOOKUP_KEY: Record<ProCheckoutPlan, ProPriceLookupKey> = {
  monthly: PRO_MONTHLY_LOOKUP_KEY,
  annual: PRO_ANNUAL_LOOKUP_KEY,
};

export function normalizeProCheckoutPlan(value: unknown): ProCheckoutPlan | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return PRO_CHECKOUT_PLANS.includes(normalized as ProCheckoutPlan)
    ? (normalized as ProCheckoutPlan)
    : null;
}

export function getLookupKeyForProCheckoutPlan(plan: ProCheckoutPlan): ProPriceLookupKey {
  return PLAN_TO_LOOKUP_KEY[plan];
}

function normalizeProLookupKey(value: unknown): ProPriceLookupKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === PRO_MONTHLY_LOOKUP_KEY || normalized === PRO_ANNUAL_LOOKUP_KEY) {
    return normalized;
  }

  return null;
}

export function resolveProCheckoutPlan(input: {
  plan?: unknown;
  priceId?: unknown;
}): ProCheckoutPlan | null {
  const fromPlan = normalizeProCheckoutPlan(input.plan);
  if (fromPlan) {
    return fromPlan;
  }

  const fromLegacyPriceId = normalizeProLookupKey(input.priceId);
  if (fromLegacyPriceId === PRO_MONTHLY_LOOKUP_KEY) {
    return "monthly";
  }
  if (fromLegacyPriceId === PRO_ANNUAL_LOOKUP_KEY) {
    return "annual";
  }

  return null;
}

export function includesProLookupKey(lookupKeys: readonly string[]): boolean {
  return lookupKeys.some((key) => {
    const normalized = key.trim().toLowerCase();
    return normalized === PRO_MONTHLY_LOOKUP_KEY || normalized === PRO_ANNUAL_LOOKUP_KEY;
  });
}
