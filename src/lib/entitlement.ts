import { Redis } from "@upstash/redis";

export type EntitlementPlan = "pro";

export type EntitlementRecord = {
  plan: EntitlementPlan;
  status: string;
  currentPeriodEnd: number;
  updatedAt: number;
};

const ENTITLEMENT_KEY_PREFIX = "rubricheck:entitlement:";
const CUSTOMER_BY_EMAIL_KEY_PREFIX = "rubricheck:customerByEmail:";
const STRIPE_LOOKUP_CACHE_BY_EMAIL_KEY_PREFIX = "rubricheck:stripeLookupByEmail:";

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

function getEntitlementKey(customerId: string): string {
  return `${ENTITLEMENT_KEY_PREFIX}${customerId}`;
}

function getCustomerByEmailKey(email: string): string {
  return `${CUSTOMER_BY_EMAIL_KEY_PREFIX}${normalizeEmail(email)}`;
}

function getStripeLookupCacheByEmailKey(email: string): string {
  return `${STRIPE_LOOKUP_CACHE_BY_EMAIL_KEY_PREFIX}${normalizeEmail(email)}`;
}

function parseEntitlement(value: unknown): EntitlementRecord | null {
  if (typeof value === "string") {
    try {
      return parseEntitlement(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as {
    plan?: unknown;
    status?: unknown;
    currentPeriodEnd?: unknown;
    updatedAt?: unknown;
  };

  if (raw.plan !== "pro") {
    return null;
  }

  if (typeof raw.status !== "string" || !raw.status.trim()) {
    return null;
  }

  if (typeof raw.currentPeriodEnd !== "number" || !Number.isFinite(raw.currentPeriodEnd)) {
    return null;
  }

  const updatedAt =
    typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Math.floor(Date.now() / 1000);

  return {
    plan: "pro",
    status: raw.status,
    currentPeriodEnd: raw.currentPeriodEnd,
    updatedAt,
  };
}

type StripeLookupCacheRecord = {
  customerId: string | null;
  entitlement: EntitlementRecord | null;
  checkedAt: number;
};

function parseStripeLookupCacheRecord(value: unknown): StripeLookupCacheRecord | null {
  if (typeof value === "string") {
    try {
      return parseStripeLookupCacheRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as {
    customerId?: unknown;
    entitlement?: unknown;
    checkedAt?: unknown;
  };

  const customerId =
    typeof raw.customerId === "string" && raw.customerId.trim().length > 0
      ? raw.customerId.trim()
      : null;

  const entitlement = parseEntitlement(raw.entitlement);
  const checkedAt =
    typeof raw.checkedAt === "number" && Number.isFinite(raw.checkedAt)
      ? raw.checkedAt
      : Math.floor(Date.now() / 1000);

  return {
    customerId,
    entitlement,
    checkedAt,
  };
}

export async function setEntitlementForCustomer(
  customerId: string,
  entitlement: EntitlementRecord,
): Promise<void> {
  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) {
    throw new Error("CUSTOMER_ID_MISSING");
  }

  await getRedisClient().set(getEntitlementKey(normalizedCustomerId), entitlement);
}

export async function setCustomerIdByEmail(email: string, customerId: string): Promise<void> {
  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedCustomerId = customerId.trim();
  if (!normalizedEmail) {
    throw new Error("EMAIL_MISSING");
  }
  if (!normalizedCustomerId) {
    throw new Error("CUSTOMER_ID_MISSING");
  }

  await getRedisClient().set(getCustomerByEmailKey(normalizedEmail), normalizedCustomerId);
}

export async function getEntitlementByCustomerId(customerId: string): Promise<EntitlementRecord | null> {
  if (!hasRedisConfig()) {
    return null;
  }

  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) {
    return null;
  }

  const raw = await getRedisClient().get(getEntitlementKey(normalizedCustomerId));
  return parseEntitlement(raw);
}

export async function getCustomerIdByEmail(email: string): Promise<string | null> {
  if (!hasRedisConfig()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const raw = await getRedisClient().get(getCustomerByEmailKey(normalizedEmail));
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function getEntitlementByEmail(email: string): Promise<EntitlementRecord | null> {
  const customerId = await getCustomerIdByEmail(email);
  if (!customerId) {
    return null;
  }

  return getEntitlementByCustomerId(customerId);
}

export async function getCachedStripeLookupByEmail(email: string): Promise<StripeLookupCacheRecord | null> {
  if (!hasRedisConfig()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const raw = await getRedisClient().get(getStripeLookupCacheByEmailKey(normalizedEmail));
  return parseStripeLookupCacheRecord(raw);
}

export async function setCachedStripeLookupByEmail(
  email: string,
  value: StripeLookupCacheRecord,
  ttlSeconds: number,
): Promise<void> {
  if (!hasRedisConfig()) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("EMAIL_MISSING");
  }

  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("INVALID_TTL");
  }

  await getRedisClient().set(getStripeLookupCacheByEmailKey(normalizedEmail), value, {
    ex: Math.floor(ttlSeconds),
  });
}
