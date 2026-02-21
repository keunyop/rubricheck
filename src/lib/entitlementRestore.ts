import Stripe from "stripe";

import {
  getCachedStripeLookupByEmail,
  getCustomerIdByEmail,
  getEntitlementByCustomerId,
  setCachedStripeLookupByEmail,
  setCustomerIdByEmail,
  setEntitlementForCustomer,
  type EntitlementRecord,
} from "./entitlement";
import { isActiveProEntitlement, isValidEmail, normalizeEmailInput } from "./entitlementRestoreShared";

export { normalizeEmailInput, isValidEmail } from "./entitlementRestoreShared";

const PLAN_ALIAS_PRO_MONTHLY = "pro_monthly";
const STRIPE_LOOKUP_CACHE_TTL_SECONDS = 60 * 5;

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY_MISSING");
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));

  if (periodEnds.length > 0) {
    return Math.max(...periodEnds);
  }

  return subscription.cancel_at ?? subscription.ended_at ?? getNowSeconds();
}

function isSubscriptionStatusPro(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

function getSubscriptionLookupKeys(subscription: Stripe.Subscription): string[] {
  return subscription.items.data
    .map((item) => {
      const price = item.price;
      if (!price || typeof price === "string") {
        return null;
      }

      return typeof price.lookup_key === "string" ? price.lookup_key.trim() : null;
    })
    .filter((value): value is string => Boolean(value));
}

function isProMonthlySubscription(subscription: Stripe.Subscription): boolean {
  const lookupKeys = getSubscriptionLookupKeys(subscription);
  return lookupKeys.includes(PLAN_ALIAS_PRO_MONTHLY);
}

function mapSubscriptionToEntitlement(subscription: Stripe.Subscription): EntitlementRecord {
  return {
    plan: "pro",
    status: isSubscriptionStatusPro(subscription.status) ? "active" : "canceled",
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
    updatedAt: getNowSeconds(),
  };
}

export function isActiveEntitlement(entitlement: EntitlementRecord | null): entitlement is EntitlementRecord {
  return isActiveProEntitlement(entitlement, getNowSeconds());
}

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function listSubscriptionsByCustomer(customerId: string): Promise<Stripe.Subscription[]> {
  const subscriptions = await getStripeClient().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
    expand: ["data.items.data.price"],
  });

  return subscriptions.data;
}

function getBestActiveEntitlementFromSubscriptions(subscriptions: Stripe.Subscription[]): EntitlementRecord | null {
  return subscriptions
    .filter((subscription) => isProMonthlySubscription(subscription))
    .map((subscription) => mapSubscriptionToEntitlement(subscription))
    .filter((entitlement) => isActiveEntitlement(entitlement))
    .sort((a, b) => b.currentPeriodEnd - a.currentPeriodEnd)[0] ?? null;
}

async function getActiveEntitlementByCustomerId(customerId: string): Promise<EntitlementRecord | null> {
  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) {
    return null;
  }

  const subscriptions = await listSubscriptionsByCustomer(normalizedCustomerId);
  return getBestActiveEntitlementFromSubscriptions(subscriptions);
}

async function findCustomerIdsByEmail(email: string): Promise<string[]> {
  const normalizedEmail = normalizeEmailInput(email);
  if (!normalizedEmail) {
    return [];
  }

  try {
    const searchResult = await getStripeClient().customers.search({
      query: `email:'${escapeStripeSearchValue(normalizedEmail)}'`,
      limit: 10,
    });

    return searchResult.data
      .map((customer) => customer.id.trim())
      .filter((customerId) => customerId.length > 0);
  } catch {
    const listResult = await getStripeClient().customers.list({
      email: normalizedEmail,
      limit: 10,
    });

    return listResult.data
      .map((customer) => customer.id.trim())
      .filter((customerId) => customerId.length > 0);
  }
}

type CustomerEntitlementCandidate = {
  customerId: string;
  entitlement: EntitlementRecord;
};

async function findBestActiveEntitlementByEmail(email: string): Promise<CustomerEntitlementCandidate | null> {
  const customerIds = await findCustomerIdsByEmail(email);
  if (customerIds.length === 0) {
    return null;
  }

  const candidates: CustomerEntitlementCandidate[] = [];

  for (const customerId of customerIds) {
    const entitlement = await getActiveEntitlementByCustomerId(customerId);
    if (entitlement) {
      candidates.push({ customerId, entitlement });
    }
  }

  return candidates.sort((a, b) => b.entitlement.currentPeriodEnd - a.entitlement.currentPeriodEnd)[0] ?? null;
}

type ResolveActiveEntitlementResult = {
  customerId: string;
  entitlement: EntitlementRecord;
};

async function cacheStripeLookupResult(
  email: string,
  value: {
    customerId: string | null;
    entitlement: EntitlementRecord | null;
  },
): Promise<void> {
  try {
    await setCachedStripeLookupByEmail(
      email,
      {
        customerId: value.customerId,
        entitlement: value.entitlement,
        checkedAt: getNowSeconds(),
      },
      STRIPE_LOOKUP_CACHE_TTL_SECONDS,
    );
  } catch {
    // Cache misses should not block restore.
  }
}

export async function resolveActiveEntitlementByVerifiedEmail(
  email: string,
): Promise<ResolveActiveEntitlementResult | null> {
  const normalizedEmail = normalizeEmailInput(email);
  if (!isValidEmail(normalizedEmail)) {
    throw new Error("INVALID_EMAIL");
  }

  const cachedLookup = await getCachedStripeLookupByEmail(normalizedEmail);
  if (cachedLookup) {
    if (cachedLookup.customerId && cachedLookup.entitlement && isActiveEntitlement(cachedLookup.entitlement)) {
      return {
        customerId: cachedLookup.customerId,
        entitlement: cachedLookup.entitlement,
      };
    }

    if (!cachedLookup.entitlement) {
      return null;
    }
  }

  const customerIdFromRedis = await getCustomerIdByEmail(normalizedEmail);
  if (customerIdFromRedis) {
    const redisEntitlement = await getEntitlementByCustomerId(customerIdFromRedis);
    if (isActiveEntitlement(redisEntitlement)) {
      await cacheStripeLookupResult(normalizedEmail, {
        customerId: customerIdFromRedis,
        entitlement: redisEntitlement,
      });
      return {
        customerId: customerIdFromRedis,
        entitlement: redisEntitlement,
      };
    }

    const stripeEntitlement = await getActiveEntitlementByCustomerId(customerIdFromRedis);
    if (stripeEntitlement) {
      await Promise.all([
        setCustomerIdByEmail(normalizedEmail, customerIdFromRedis),
        setEntitlementForCustomer(customerIdFromRedis, stripeEntitlement),
        cacheStripeLookupResult(normalizedEmail, {
          customerId: customerIdFromRedis,
          entitlement: stripeEntitlement,
        }),
      ]);
      return {
        customerId: customerIdFromRedis,
        entitlement: stripeEntitlement,
      };
    }
  }

  const bestCandidate = await findBestActiveEntitlementByEmail(normalizedEmail);
  if (!bestCandidate) {
    await cacheStripeLookupResult(normalizedEmail, {
      customerId: customerIdFromRedis ?? null,
      entitlement: null,
    });
    return null;
  }

  await Promise.all([
    setCustomerIdByEmail(normalizedEmail, bestCandidate.customerId),
    setEntitlementForCustomer(bestCandidate.customerId, bestCandidate.entitlement),
    cacheStripeLookupResult(normalizedEmail, {
      customerId: bestCandidate.customerId,
      entitlement: bestCandidate.entitlement,
    }),
  ]);

  return bestCandidate;
}
