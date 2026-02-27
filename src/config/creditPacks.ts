export const CREDIT_PACK_IDS = ["10", "25", "60"] as const;

export type CreditPackId = (typeof CREDIT_PACK_IDS)[number];

type CreditPackConfig = {
  lookupKey: string;
  credits: number;
  label: string;
  marketingLabel: string;
  priceLabel: string;
};

const CREDIT_PACK_CONFIG: Record<CreditPackId, CreditPackConfig> = {
  "10": {
    lookupKey: "credits_10_v1",
    credits: 10,
    label: "10 evaluations",
    marketingLabel: "Starter",
    priceLabel: "$4.99",
  },
  "25": {
    lookupKey: "credits_25_v1",
    credits: 25,
    label: "25 evaluations",
    marketingLabel: "Most Popular",
    priceLabel: "$9.99",
  },
  "60": {
    lookupKey: "credits_60_v1",
    credits: 60,
    label: "60 evaluations",
    marketingLabel: "Best Value",
    priceLabel: "$19.99",
  },
};

const LOOKUP_KEY_TO_PACK_ID = Object.entries(CREDIT_PACK_CONFIG).reduce<Record<string, CreditPackId>>(
  (acc, [packId, config]) => {
    acc[config.lookupKey.toLowerCase()] = packId as CreditPackId;
    return acc;
  },
  {},
);

export function normalizeCreditPackId(value: unknown): CreditPackId | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return CREDIT_PACK_IDS.includes(normalized as CreditPackId) ? (normalized as CreditPackId) : null;
}

export function getLookupKeyForCreditPack(packId: CreditPackId): string {
  return CREDIT_PACK_CONFIG[packId].lookupKey;
}

export function getCreditsForCreditPack(packId: CreditPackId): number {
  return CREDIT_PACK_CONFIG[packId].credits;
}

export function getCreditPackLabel(packId: CreditPackId): string {
  return CREDIT_PACK_CONFIG[packId].label;
}

export function getCreditPackMarketingLabel(packId: CreditPackId): string {
  return CREDIT_PACK_CONFIG[packId].marketingLabel;
}

export function getCreditPackPriceLabel(packId: CreditPackId): string {
  return CREDIT_PACK_CONFIG[packId].priceLabel;
}

export function resolveCreditPackIdFromLookupKey(lookupKey: unknown): CreditPackId | null {
  if (typeof lookupKey !== "string") {
    return null;
  }

  const normalized = lookupKey.trim().toLowerCase();
  return LOOKUP_KEY_TO_PACK_ID[normalized] ?? null;
}
