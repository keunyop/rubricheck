export const FREE_LIMIT_REACHED_CODE = "FREE_LIMIT_REACHED" as const;
export const SHOW_INTERSTITIAL_ACTION = "SHOW_INTERSTITIAL" as const;

export type FreeLimitReachedPayload = {
  code: typeof FREE_LIMIT_REACHED_CODE;
  action: typeof SHOW_INTERSTITIAL_ACTION;
  freeLimit: number;
};

export function buildFreeLimitReachedPayload(limit: number): FreeLimitReachedPayload {
  return {
    code: FREE_LIMIT_REACHED_CODE,
    action: SHOW_INTERSTITIAL_ACTION,
    freeLimit: limit,
  };
}
