import { Redis } from "@upstash/redis";

import { getCustomerIdByEmail, setCustomerIdByEmail } from "./entitlement";
import { getCreditEmailFromCookie } from "./creditSession";

const CREDITS_BY_CUSTOMER_KEY_PREFIX = "rubricheck:credits:customer:";
const CREDITS_BY_EMAIL_KEY_PREFIX = "rubricheck:credits:email:";
const CREDIT_SESSION_PROCESSED_KEY_PREFIX = "rubricheck:credits:processedSession:";
const CREDIT_SESSION_PROCESSED_TTL_SECONDS = 60 * 60 * 24 * 180;

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
};

let redisClient: Redis | null = null;

function hasRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token);
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

async function readCreditsByKey(key: string): Promise<number> {
  const raw = await getRedisClient().get(key);
  return parseCredits(raw);
}

async function incrementCreditsByKey(key: string, amount: number): Promise<number> {
  const nextBalance = await getRedisClient().incrby(key, amount);
  return parseCredits(nextBalance);
}

async function ensureEmailCreditsMigratedToCustomer(email: string, customerId: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCustomerId = customerId.trim();
  if (!normalizedEmail || !normalizedCustomerId) {
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
      await setCustomerIdByEmail(params.email, rawCustomerId);
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

  const mappedCustomerId = await getCustomerIdByEmail(normalizedEmail);
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
  if (!hasRedisConfig()) {
    return 0;
  }

  return readCreditsByKey(creditTargetToKey(target));
}

export async function getCreditBalanceForRequest(request: Request): Promise<number | null> {
  if (!hasRedisConfig()) {
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
  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const email = getCreditEmailFromCookie(request);
  const target = await resolveCreditStorageTarget({ email });
  if (!target) {
    return {
      reserved: false,
      balanceAfter: 0,
      reservation: null,
    };
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
    reservation: { target },
  };
}

export async function refundCreditReservation(reservation: CreditReservation): Promise<number> {
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
}): Promise<number> {
  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

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

  return incrementCreditsByKey(creditTargetToKey(target), amount);
}

export async function markCreditsSessionProcessed(sessionId: string): Promise<boolean> {
  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    throw new Error("STRIPE_SESSION_ID_MISSING");
  }

  const result = await getRedisClient().set(getCreditsProcessedSessionKey(normalizedSessionId), "1", {
    nx: true,
    ex: CREDIT_SESSION_PROCESSED_TTL_SECONDS,
  });

  return result === "OK";
}
