import { randomUUID } from "node:crypto";
import { callSupabaseRpc, hasSupabaseConfig } from "./supabaseRest.ts";

type FreeEvaluateUsageRow = {
  allowed?: unknown;
  count?: unknown;
  remaining?: unknown;
};

export type FreeEvaluateUsageResult = {
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

export type FreeUsageReservation = { email: string; id: string; limit: number };
export type FreeUsageReservationResult = FreeEvaluateUsageResult & {
  status: "reserved" | "pending" | "succeeded" | "exhausted";
  reservation?: FreeUsageReservation;
};

export async function reserveFreeEvaluateUsage(
  email: string,
  limit: number,
  requestKey: string = randomUUID(),
): Promise<FreeUsageReservationResult> {
  if (!hasSupabaseConfig()) throw new Error("FREE_USAGE_STORE_UNAVAILABLE");
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("INVALID_EMAIL");
  const reservation = { email: normalizedEmail, id: randomUUID(), limit };
  try {
    const raw = await callSupabaseRpc<FreeEvaluateUsageRow & { status?: unknown }>("rubricheck_reserve_free_evaluate", {
      p_email: normalizedEmail, p_limit: limit, p_request_key: requestKey, p_reservation_id: reservation.id,
    });
    if (!["reserved", "pending", "succeeded", "exhausted"].includes(String(raw?.status))) {
      throw new Error("INVALID_FREE_USAGE_RESERVATION");
    }
    const status = raw.status as FreeUsageReservationResult["status"];
    return {
      allowed: status === "reserved", status,
      count: parseCount(raw.count), remaining: parseCount(raw.remaining),
      reservation: status === "reserved" ? reservation : undefined,
    };
  } catch (error) {
    // A lost response can follow a committed reservation. Release only our attempt.
    try { await settleFreeEvaluateUsage(reservation, false); } catch { /* The lease also expires. */ }
    throw error;
  }
}

export async function settleFreeEvaluateUsage(
  reservation: FreeUsageReservation,
  succeeded: boolean,
): Promise<number> {
  const raw = await callSupabaseRpc<FreeEvaluateUsageRow>("rubricheck_settle_free_evaluate", {
    p_email: reservation.email, p_reservation_id: reservation.id,
    p_succeeded: succeeded, p_limit: reservation.limit,
  });
  if (!parseBoolean(raw?.allowed)) throw new Error("FREE_USAGE_SETTLEMENT_FAILED");
  return parseCount(raw.remaining);
}
