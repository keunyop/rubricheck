import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { AccountEntitlementRecord } from "./accountEntitlements.ts";
import type { EntitlementRecord } from "./entitlement.ts";
import { LIFETIME_PERIOD_END } from "./proLifetimePolicy.ts";

const records = new Map<string, AccountEntitlementRecord>();
const redis = new Map<string, EntitlementRecord>();
let failWrite = false;
let cachedCustomer: string | null = null;
mock.module("./accountEntitlements.ts", { namedExports: {
  hasAccountEntitlementStore: () => true,
  upsertAccountEntitlement: async (value: AccountEntitlementRecord) => {
    if (failWrite) throw new Error("database unavailable");
    records.set(value.customerId, { ...value, plan: "pro", updatedAt: 1 });
  },
  getAccountEntitlementByEmail: async (email: string) => [...records.values()].filter(value => value.email === email)
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.currentPeriodEnd - a.currentPeriodEnd)[0] ?? null,
} });
mock.module("./entitlement.ts", { namedExports: {
  setEntitlementForCustomer: async (customerId: string, value: EntitlementRecord) => { redis.set(customerId, value); },
  setCustomerIdByEmail: async () => {},
  setCachedStripeLookupByEmail: async (_email: string, value: { customerId: string | null }) => { cachedCustomer = value.customerId; },
} });
const { persistLifetimeCheckout } = await import("./proLifetime.ts");
const purchase = { customerId: "cus_lifetime", email: "student@example.com",
  entitlement: { plan: "pro" as const, status: "active", currentPeriodEnd: LIFETIME_PERIOD_END, updatedAt: 1 } };

test("repeated lifetime fulfillment keeps a single durable entitlement", async () => {
  await persistLifetimeCheckout(purchase);
  await persistLifetimeCheckout(purchase);
  assert.equal(records.size, 1);
  assert.equal(records.get("cus_lifetime")?.currentPeriodEnd, LIFETIME_PERIOD_END);
  assert.equal(redis.get("cus_lifetime")?.status, "active");
});

test("refund revokes only the lifetime purchase and preserves another active subscription", async () => {
  await persistLifetimeCheckout(purchase);
  records.set("cus_subscription", { customerId: "cus_subscription", email: purchase.email, plan: "pro",
    status: "active", currentPeriodEnd: 2000000000, updatedAt: 1 });
  await persistLifetimeCheckout({ ...purchase, entitlement: { ...purchase.entitlement, status: "canceled", currentPeriodEnd: 0 } });
  assert.equal(records.get("cus_lifetime")?.status, "canceled");
  assert.equal(records.get("cus_subscription")?.status, "active");
  assert.equal(cachedCustomer, "cus_subscription");
});

test("a failed durable write cannot publish active lifetime access into Redis", async () => {
  records.clear(); redis.clear(); failWrite = true;
  try {
    await assert.rejects(persistLifetimeCheckout(purchase), /database unavailable/);
    assert.equal(redis.size, 0);
  } finally { failWrite = false; }
  await persistLifetimeCheckout(purchase);
  assert.equal(records.get("cus_lifetime")?.status, "active", "Retry can recover the purchase");
});
