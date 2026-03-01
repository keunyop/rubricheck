import Stripe from "stripe";

import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { includesProLookupKey } from "../../../../src/config/proCheckout";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { findCustomerIdsByEmail, getStripeClient } from "../../../../src/lib/stripeServer";

export const runtime = "nodejs";

type BillingStatus = "none" | "active" | "canceling" | "canceled";

type ProSubscriptionSummary = {
  customerId: string;
  subscriptionId: string;
  status: Stripe.Subscription.Status;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  canceledAt: number | null;
  currentPeriodEnd: number;
};

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

function isProSubscription(subscription: Stripe.Subscription): boolean {
  return includesProLookupKey(getSubscriptionLookupKeys(subscription));
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));

  if (periodEnds.length > 0) {
    return Math.max(...periodEnds);
  }

  return subscription.cancel_at ?? subscription.ended_at ?? Math.floor(Date.now() / 1000);
}

function summarizeSubscription(customerId: string, subscription: Stripe.Subscription): ProSubscriptionSummary {
  return {
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    cancelAt: typeof subscription.cancel_at === "number" && Number.isFinite(subscription.cancel_at) ? subscription.cancel_at : null,
    canceledAt:
      typeof subscription.canceled_at === "number" && Number.isFinite(subscription.canceled_at) ? subscription.canceled_at : null,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  };
}

function getBillingStatus(summary: ProSubscriptionSummary | null): BillingStatus {
  if (!summary) {
    return "none";
  }

  const hasScheduledCancellation =
    summary.cancelAtPeriodEnd ||
    (summary.cancelAt !== null && summary.cancelAt >= Math.floor(Date.now() / 1000)) ||
    (summary.canceledAt !== null && summary.currentPeriodEnd >= Math.floor(Date.now() / 1000));

  if ((summary.status === "active" || summary.status === "trialing") && hasScheduledCancellation) {
    return "canceling";
  }

  if (summary.status === "active" || summary.status === "trialing") {
    return "active";
  }

  return "canceled";
}

function compareSubscriptionPriority(a: ProSubscriptionSummary, b: ProSubscriptionSummary): number {
  const priority = (value: ProSubscriptionSummary) => {
    const billingStatus = getBillingStatus(value);
    if (billingStatus === "canceling") {
      return 0;
    }
    if (billingStatus === "active") {
      return 1;
    }
    return 2;
  };

  const priorityDiff = priority(a) - priority(b);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return b.currentPeriodEnd - a.currentPeriodEnd;
}

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const signedInEmail = getCreditEmailFromCookie(request);

  if (!signedInEmail) {
    return errorResponse(context, 401, "AUTH_REQUIRED", "Log in before viewing billing status.");
  }

  try {
    const stripe = getStripeClient();
    const customerIds = await findCustomerIdsByEmail(signedInEmail);
    const summaries: ProSubscriptionSummary[] = [];

    for (const customerId of customerIds) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 20,
        expand: ["data.items.data.price"],
      });

      for (const subscription of subscriptions.data) {
        if (!isProSubscription(subscription)) {
          continue;
        }

        summaries.push(summarizeSubscription(customerId, subscription));
      }
    }

    const bestMatch = summaries.sort(compareSubscriptionPriority)[0] ?? null;
    const billingStatus = getBillingStatus(bestMatch);

    return successJson(context, {
      status: billingStatus,
      hasProSubscription: billingStatus === "active" || billingStatus === "canceling",
      cancelAtPeriodEnd: bestMatch?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: bestMatch?.currentPeriodEnd ?? null,
      customerId: bestMatch?.customerId ?? null,
      subscriptionId: bestMatch?.subscriptionId ?? null,
    });
  } catch (error) {
    console.error("BILLING_STATUS_FETCH_FAILED", {
      requestId: context.requestId,
      error,
    });
    return errorResponse(context, 500, "BILLING_STATUS_FETCH_FAILED", "Unable to load billing status right now.");
  }
}
