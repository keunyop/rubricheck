import Stripe from "stripe";

import { includesProLookupKey } from "../config/proCheckout";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
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

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findCustomerIdsByEmail(email: string): Promise<string[]> {
  const stripe = getStripeClient();
  try {
    const searchResult = await stripe.customers.search({
      query: `email:'${escapeStripeSearchValue(email)}'`,
      limit: 10,
    });

    return searchResult.data
      .map((customer) => customer.id.trim())
      .filter((customerId) => customerId.length > 0);
  } catch {
    const listResult = await stripe.customers.list({
      email,
      limit: 10,
    });

    return listResult.data
      .map((customer) => customer.id.trim())
      .filter((customerId) => customerId.length > 0);
  }
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

function isManageableProSubscription(subscription: Stripe.Subscription): boolean {
  if (!includesProLookupKey(getSubscriptionLookupKeys(subscription))) {
    return false;
  }

  return !["canceled", "incomplete_expired"].includes(subscription.status);
}

export async function findManageableProCustomerIdByEmail(email: string): Promise<string | null> {
  const stripe = getStripeClient();
  const customerIds = await findCustomerIdsByEmail(email);

  for (const customerId of customerIds) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
      expand: ["data.items.data.price"],
    });

    if (subscriptions.data.some((subscription) => isManageableProSubscription(subscription))) {
      return customerId;
    }
  }

  return customerIds[0] ?? null;
}
