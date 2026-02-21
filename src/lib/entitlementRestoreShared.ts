export type EntitlementLike = {
  plan: string;
  status: string;
  currentPeriodEnd: number;
} | null;

export function normalizeEmailInput(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isActiveProEntitlement(entitlement: EntitlementLike, nowSeconds: number): boolean {
  if (!entitlement) {
    return false;
  }

  if (entitlement.plan !== "pro" || entitlement.status !== "active") {
    return false;
  }

  return entitlement.currentPeriodEnd >= nowSeconds;
}
