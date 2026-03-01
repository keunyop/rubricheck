import { callSupabaseRpc, hasSupabaseConfig } from "./supabaseRest.ts";

type ConsumeFreeEvaluateUsageRow = {
  allowed?: unknown;
  count?: unknown;
  remaining?: unknown;
};

export type ConsumeFreeEvaluateUsageResult = {
  allowed: boolean;
  count: number;
  remaining: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "t";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

export async function getFreeEvaluateUsageCount(email: string): Promise<number | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const raw = await callSupabaseRpc<number>("rubricheck_get_free_evaluate_usage_count", {
    p_email: normalizedEmail,
  });

  return parseCount(raw);
}

export async function consumeFreeEvaluateUsage(
  email: string,
  limit: number,
): Promise<ConsumeFreeEvaluateUsageResult> {
  if (!hasSupabaseConfig()) {
    throw new Error("FREE_USAGE_STORE_UNAVAILABLE");
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("INVALID_EMAIL");
  }

  const raw = await callSupabaseRpc<ConsumeFreeEvaluateUsageRow>("rubricheck_consume_free_evaluate", {
    p_email: normalizedEmail,
    p_limit: Math.max(0, Math.floor(limit)),
  });

  return {
    allowed: parseBoolean(raw?.allowed),
    count: parseCount(raw?.count),
    remaining: parseCount(raw?.remaining),
  };
}
