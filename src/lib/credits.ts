import { Redis } from "@upstash/redis";

import { getCustomerIdByEmail, setCustomerIdByEmail } from "./entitlement";
import { getCreditEmailFromCookie } from "./creditSession";
import { callSupabaseRpc, hasSupabaseConfig } from "./supabaseRest";

const CREDITS_BY_CUSTOMER_KEY_PREFIX = "rubricheck:credits:customer:";
const CREDITS_BY_EMAIL_KEY_PREFIX = "rubricheck:credits:email:";
const CREDIT_SESSION_PROCESSED_KEY_PREFIX = "rubricheck:credits:processedSession:";
const CREDIT_SESSION_PROCESSED_TTL_SECONDS = 60 * 60 * 24 * 180;
const BILLING_SCOPE_CHECKOUT_SESSION = "checkout_session";

export type CreditStorageTarget =
  | {
      type: "customer";
      customerId: string;
    }
  | {
      type: "email";
      email: string;
    };

export type CreditReservation = {
  target: CreditStorageTarget;
  backend: "supabase" | "redis";
  usageEventId?: string | null;
  lotId?: number | null;
};

type SupabaseReserveResult = {
  reserved?: unknown;
  balance_after?: unknown;
  usage_event_id?: unknown;
  lot_id?: unknown;
};

let redisClient: Redis | null = null;

function hasRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token);
}

function hasCreditStorageConfig(): boolean {
  return hasSupabaseConfig() || hasRedisConfig();
}

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getCreditsByCustomerKey(customerId: string): string {
  return `${CREDITS_BY_CUSTOMER_KEY_PREFIX}${customerId.trim()}`;
}

function getCreditsByEmailKey(email: string): string {
  return `${CREDITS_BY_EMAIL_KEY_PREFIX}${normalizeEmail(email)}`;
}

function getCreditsProcessedSessionKey(sessionId: string): string {
  return `${CREDIT_SESSION_PROCESSED_KEY_PREFIX}${sessionId.trim()}`;
}

function parseCredits(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number.parseInt(value.trim(), 10);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  }

  return 0;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isRedisConfigMissingError(error: unknown): boolean {
  return error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING";
}

function shouldIgnoreRedisIdentityError(error: unknown): boolean {
  if (hasSupabaseConfig()) {
    return true;
  }

  return isRedisConfigMissingError(error);
}

async function readCreditsByKey(key: string): Promise<number> {
  const raw = await getRedisClient().get(key);
  return parseCredits(raw);
}

async function incrementCreditsByKey(key: string, amount: number): Promise<number> {
  const nextBalance = await getRedisClient().incrby(key, amount);
  return parseCredits(nextBalance);
}

function targetToOwner(target: CreditStorageTarget): { ownerType: "customer" | "email"; ownerId: string } {
  if (target.type === "customer") {
    return { ownerType: "customer", ownerId: target.customerId.trim() };
  }

  return { ownerType: "email", ownerId: normalizeEmail(target.email) };
}

async function readCreditsByTargetSupabase(target: CreditStorageTarget): Promise<number> {
  const owner = targetToOwner(target);
  const raw = await callSupabaseRpc<number>("rubricheck_credit_balance", {
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
  });
  return parseCredits(raw);
}

async function migrateEmailCreditsToCustomerSupabase(email: string, customerId: string): Promise<void> {
  await callSupabaseRpc<number>("rubricheck_migrate_credit_owner", {
    p_email: normalizeEmail(email),
    p_customer_id: customerId.trim(),
  });
}

async function markBillingEventProcessedSupabase(scope: string, externalId: string): Promise<boolean> {
  const raw = await callSupabaseRpc<boolean>("rubricheck_mark_billing_event_processed", {
    p_scope: scope.trim(),
    p_external_id: externalId.trim(),
  });
  return parseBoolean(raw);
}

async function grantCreditsSupabase(params: {
  amount: number;
  target: CreditStorageTarget;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  customerId?: string | null;
  email?: string | null;
  creditPackId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}): Promise<number> {
  const owner = targetToOwner(params.target);
  const raw = await callSupabaseRpc<number>("rubricheck_grant_credit_purchase", {
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
    p_credits: Math.floor(params.amount),
    p_checkout_session_id: params.checkoutSessionId ?? null,
    p_payment_intent_id: params.paymentIntentId ?? null,
    p_customer_id: params.customerId ?? null,
    p_email: params.email ?? null,
    p_credit_pack_id: params.creditPackId ?? null,
    p_amount_total: params.amountTotal ?? null,
    p_currency: params.currency ?? null,
  });
  return parseCredits(raw);
}

async function reserveOneCreditSupabase(target: CreditStorageTarget): Promise<{
  reserved: boolean;
  balanceAfter: number;
  reservation: CreditReservation | null;
}> {
  const owner = targetToOwner(target);
  const raw = await callSupabaseRpc<SupabaseReserveResult>("rubricheck_reserve_one_credit", {
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
  });

  const reserved = parseBoolean(raw?.reserved);
  const balanceAfter = parseCredits(raw?.balance_after);
  const usageEventId = parseNullableString(raw?.usage_event_id);
  const lotId = parseCredits(raw?.lot_id);

  if (!reserved || !usageEventId) {
    return {
      reserved: false,
      balanceAfter,
      reservation: null,
    };
  }

  return {
    reserved: true,
    balanceAfter,
    reservation: {
      target,
      backend: "supabase",
      usageEventId,
      lotId: lotId > 0 ? lotId : null,
    },
  };
}

async function refundReservationSupabase(reservation: CreditReservation): Promise<number> {
  const owner = targetToOwner(reservation.target);
  const raw = await callSupabaseRpc<number>("rubricheck_refund_credit_reservation", {
    p_usage_event_id: reservation.usageEventId ?? null,
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
  });
  return parseCredits(raw);
}

async function ensureEmailCreditsMigratedToCustomer(email: string, customerId: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCustomerId = customerId.trim();
  if (!normalizedEmail || !normalizedCustomerId) {
    return;
  }

  if (hasSupabaseConfig()) {
    await migrateEmailCreditsToCustomerSupabase(normalizedEmail, normalizedCustomerId);
    return;
  }

  const emailKey = getCreditsByEmailKey(normalizedEmail);
  const emailBalance = await readCreditsByKey(emailKey);
  if (emailBalance <= 0) {
    return;
  }

  await incrementCreditsByKey(getCreditsByCustomerKey(normalizedCustomerId), emailBalance);
  await getRedisClient().del(emailKey);
}

export async function resolveCreditStorageTarget(params: {
  email?: string | null;
  customerId?: string | null;
}): Promise<CreditStorageTarget | null> {
  const rawCustomerId = params.customerId?.trim() ?? "";
  if (rawCustomerId) {
    if (params.email?.trim()) {
      try {
        await setCustomerIdByEmail(params.email, rawCustomerId);
      } catch (error) {
        if (!shouldIgnoreRedisIdentityError(error)) {
          throw error;
        }
      }
      await ensureEmailCreditsMigratedToCustomer(params.email, rawCustomerId);
    }

    return {
      type: "customer",
      customerId: rawCustomerId,
    };
  }

  const normalizedEmail = params.email ? normalizeEmail(params.email) : "";
  if (!normalizedEmail) {
    return null;
  }

  let mappedCustomerId: string | null = null;
  try {
    mappedCustomerId = await getCustomerIdByEmail(normalizedEmail);
  } catch (error) {
    if (!shouldIgnoreRedisIdentityError(error)) {
      throw error;
    }
  }

  if (mappedCustomerId) {
    await ensureEmailCreditsMigratedToCustomer(normalizedEmail, mappedCustomerId);
    return {
      type: "customer",
      customerId: mappedCustomerId,
    };
  }

  return {
    type: "email",
    email: normalizedEmail,
  };
}

function creditTargetToKey(target: CreditStorageTarget): string {
  if (target.type === "customer") {
    return getCreditsByCustomerKey(target.customerId);
  }

  return getCreditsByEmailKey(target.email);
}

export async function getCreditBalanceForTarget(target: CreditStorageTarget): Promise<number> {
  if (hasSupabaseConfig()) {
    return readCreditsByTargetSupabase(target);
  }

  if (!hasRedisConfig()) {
    return 0;
  }

  return readCreditsByKey(creditTargetToKey(target));
}

export async function getCreditBalanceForRequest(request: Request): Promise<number | null> {
  if (!hasCreditStorageConfig()) {
    return null;
  }

  const email = getCreditEmailFromCookie(request);
  const target = await resolveCreditStorageTarget({
    email,
  });
  if (!target) {
    return null;
  }

  return getCreditBalanceForTarget(target);
}

export async function reserveOneCreditForRequest(request: Request): Promise<{
  reserved: boolean;
  balanceAfter: number;
  reservation: CreditReservation | null;
}> {
  const email = getCreditEmailFromCookie(request);
  const target = await resolveCreditStorageTarget({ email });
  if (!target) {
    return {
      reserved: false,
      balanceAfter: 0,
      reservation: null,
    };
  }

  if (hasSupabaseConfig()) {
    return reserveOneCreditSupabase(target);
  }

  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const key = creditTargetToKey(target);
  const decremented = await getRedisClient().decr(key);
  const nextBalance = parseCredits(decremented);
  if (decremented < 0) {
    await getRedisClient().incr(key);
    return {
      reserved: false,
      balanceAfter: 0,
      reservation: null,
    };
  }

  return {
    reserved: true,
    balanceAfter: nextBalance,
    reservation: {
      target,
      backend: "redis",
    },
  };
}

export async function refundCreditReservation(reservation: CreditReservation): Promise<number> {
  if (reservation.backend === "supabase" || hasSupabaseConfig()) {
    return refundReservationSupabase(reservation);
  }

  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const key = creditTargetToKey(reservation.target);
  const nextBalance = await getRedisClient().incr(key);
  return parseCredits(nextBalance);
}

export async function grantCredits(params: {
  amount: number;
  email?: string | null;
  customerId?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  creditPackId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}): Promise<number> {
  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_CREDIT_AMOUNT");
  }

  const target = await resolveCreditStorageTarget({
    email: params.email ?? null,
    customerId: params.customerId ?? null,
  });
  if (!target) {
    throw new Error("CREDIT_IDENTITY_MISSING");
  }

  if (hasSupabaseConfig()) {
    return grantCreditsSupabase({
      amount,
      target,
      checkoutSessionId: params.checkoutSessionId ?? null,
      paymentIntentId: params.paymentIntentId ?? null,
      customerId: params.customerId ?? null,
      email: params.email ?? null,
      creditPackId: params.creditPackId ?? null,
      amountTotal: params.amountTotal ?? null,
      currency: params.currency ?? null,
    });
  }

  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  return incrementCreditsByKey(creditTargetToKey(target), amount);
}

export async function markCreditsSessionProcessed(sessionId: string): Promise<boolean> {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    throw new Error("STRIPE_SESSION_ID_MISSING");
  }

  if (hasSupabaseConfig()) {
    return markBillingEventProcessedSupabase(BILLING_SCOPE_CHECKOUT_SESSION, normalizedSessionId);
  }

  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const result = await getRedisClient().set(getCreditsProcessedSessionKey(normalizedSessionId), "1", {
    nx: true,
    ex: CREDIT_SESSION_PROCESSED_TTL_SECONDS,
  });

  return result === "OK";
}
