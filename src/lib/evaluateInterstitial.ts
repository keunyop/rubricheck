export type EvaluateInterstitialDecision = {
  show: boolean;
  freeLimit: number | null;
};

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function getEvaluateInterstitialDecision(params: {
  status: number;
  payload: unknown;
  fallbackLimit?: number;
}): EvaluateInterstitialDecision {
  const fallbackLimit = parsePositiveInteger(params.fallbackLimit ?? null);
  if (params.status !== 429 || !params.payload || typeof params.payload !== "object") {
    return { show: false, freeLimit: fallbackLimit };
  }

  const record = params.payload as {
    code?: unknown;
    action?: unknown;
    freeLimit?: unknown;
  };

  if (record.code === "FREE_LIMIT_REACHED" && record.action === "SHOW_INTERSTITIAL") {
    return {
      show: true,
      freeLimit: parsePositiveInteger(record.freeLimit) ?? fallbackLimit,
    };
  }

  return { show: false, freeLimit: fallbackLimit };
}
