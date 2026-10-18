import type Stripe from "stripe";
import { PRO_LIFETIME_LOOKUP_KEY, PRO_LIFETIME_PRICE_CENTS } from "../config/proCheckout.ts";

// The existing entitlement stores require a finite epoch. Reserve this value for
// non-expiring Pro access; never expose it as a renewal or expiry date in the UI.
export const LIFETIME_PERIOD_END = 253402300799;

export function isLifetimeEntitlement(value: { status: string; currentPeriodEnd: number } | null): boolean {
  return value?.status === "active" && value.currentPeriodEnd === LIFETIME_PERIOD_END;
}

export function isLifetimePrice(price: Stripe.Price): boolean {
  return price.lookup_key === PRO_LIFETIME_LOOKUP_KEY && price.type === "one_time" &&
    price.currency === "usd" && price.unit_amount === PRO_LIFETIME_PRICE_CENTS;
}

export function isLifetimeLineItems(items: Stripe.LineItem[]): boolean {
  return items.length === 1 && items[0].quantity === 1 && Boolean(items[0].price && isLifetimePrice(items[0].price));
}
