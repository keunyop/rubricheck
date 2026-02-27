import { callSupabaseRpc, hasSupabaseConfig } from "./supabaseRest";

export type AccountEntitlementStatus = "active" | "canceled";

export type AccountEntitlementRecord = {
  customerId: string;
  email: string | null;
  plan: "pro";
  status: AccountEntitlementStatus;
  currentPeriodEnd: number;
  updatedAt: number | null;
};

type RawAccountEntitlement = {
  customer_id?: unknown;
  email?: unknown;
  plan?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  updated_at_epoch?: unknown;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(value: unknown): AccountEntitlementStatus | null {
  if (value === "active" || value === "canceled") {
    return value;
  }
  return null;
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseAccountEntitlement(value: unknown): AccountEntitlementRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as RawAccountEntitlement;
  const customerId = parseNonEmptyString(raw.customer_id);
  const status = normalizeStatus(raw.status);
  const currentPeriodEnd = parseFiniteNumber(raw.current_period_end);
  const updatedAt = parseFiniteNumber(raw.updated_at_epoch);

  if (!customerId || raw.plan !== "pro" || !status || currentPeriodEnd === null) {
    return null;
  }

  return {
    customerId,
    email: parseNullableString(raw.email)?.toLowerCase() ?? null,
    plan: "pro",
    status,
    currentPeriodEnd,
    updatedAt,
  };
}

function isMissingEntitlementRpcError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    message.includes("SUPABASE_RPC_FAILED:rubricheck_get_account_entitlement_by_email") ||
    message.includes("SUPABASE_RPC_FAILED:rubricheck_upsert_account_entitlement") ||
    message.includes("PGRST202")
  );
}

function isMissingEntitlementTableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("account_entitlements") && message.includes("does not exist");
}

export function isAccountEntitlementStoreUnavailableError(error: unknown): boolean {
  if (error instanceof Error && error.message === "ACCOUNT_ENTITLEMENT_STORE_UNAVAILABLE") {
    return true;
  }

  return isMissingEntitlementRpcError(error) || isMissingEntitlementTableError(error);
}

export function hasAccountEntitlementStore(): boolean {
  return hasSupabaseConfig();
}

export function isActiveProAccountEntitlement(
  entitlement: AccountEntitlementRecord | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return Boolean(
    entitlement &&
      entitlement.plan === "pro" &&
      entitlement.status === "active" &&
      entitlement.currentPeriodEnd >= nowSeconds,
  );
}

export async function upsertAccountEntitlement(params: {
  customerId: string;
  email?: string | null;
  status: AccountEntitlementStatus;
  currentPeriodEnd: number;
}): Promise<void> {
  if (!hasSupabaseConfig()) {
    return;
  }

  const customerId = params.customerId.trim();
  if (!customerId) {
    throw new Error("CUSTOMER_ID_MISSING");
  }

  if (!Number.isFinite(params.currentPeriodEnd)) {
    throw new Error("INVALID_CURRENT_PERIOD_END");
  }

  try {
    await callSupabaseRpc<null>("rubricheck_upsert_account_entitlement", {
      p_customer_id: customerId,
      p_email: params.email ? normalizeEmail(params.email) : null,
      p_status: params.status,
      p_current_period_end: Math.floor(params.currentPeriodEnd),
    });
  } catch (error) {
    if (isAccountEntitlementStoreUnavailableError(error)) {
      return;
    }
    throw error;
  }
}

export async function getAccountEntitlementByEmail(email: string): Promise<AccountEntitlementRecord | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  let raw: unknown;
  try {
    raw = await callSupabaseRpc<unknown>("rubricheck_get_account_entitlement_by_email", {
      p_email: normalizedEmail,
    });
  } catch (error) {
    if (isAccountEntitlementStoreUnavailableError(error)) {
      throw new Error("ACCOUNT_ENTITLEMENT_STORE_UNAVAILABLE");
    }
    throw error;
  }

  return parseAccountEntitlement(raw);
}
