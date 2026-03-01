import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import {
  getRefundableCreditSummaryForTarget,
  markCreditPaymentRefunded,
  resolveCreditStorageTarget,
} from "../../../../src/lib/credits";
import { hasSupabaseConfig } from "../../../../src/lib/supabaseRest";
import { getStripeClient } from "../../../../src/lib/stripeServer";

export const runtime = "nodejs";

function formatCurrencyAmount(amount: number, currency: string | null): string {
  if (!currency) {
    return String(amount);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const signedInEmail = getCreditEmailFromCookie(request);

  if (!signedInEmail) {
    return errorResponse(context, 401, "AUTH_REQUIRED", "Log in before viewing refundable top-ups.");
  }

  if (!hasSupabaseConfig()) {
    return successJson(context, {
      supported: false,
      refundableCredits: 0,
      refundableAmount: 0,
      currency: null,
    });
  }

  try {
    const target = await resolveCreditStorageTarget({ email: signedInEmail });
    if (!target) {
      return errorResponse(context, 404, "CREDIT_IDENTITY_NOT_FOUND", "No credit account was found for this user.");
    }

    const summary = await getRefundableCreditSummaryForTarget(target);
    return successJson(context, {
      supported: true,
      refundableCredits: summary?.refundableCredits ?? 0,
      refundableAmount: summary?.refundableAmount ?? 0,
      currency: summary?.currency ?? null,
    });
  } catch (error) {
    console.error("CREDIT_REFUND_SUMMARY_FAILED", {
      requestId: context.requestId,
      error,
    });
    return errorResponse(context, 500, "CREDIT_REFUND_SUMMARY_FAILED", "Unable to load refundable top-ups right now.");
  }
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const signedInEmail = getCreditEmailFromCookie(request);

  if (!signedInEmail) {
    return errorResponse(context, 401, "AUTH_REQUIRED", "Log in before refunding top-ups.");
  }

  if (!hasSupabaseConfig()) {
    return errorResponse(context, 409, "CREDIT_REFUND_UNSUPPORTED", "Top-up refunds are not configured for this environment.");
  }

  try {
    const target = await resolveCreditStorageTarget({ email: signedInEmail });
    if (!target) {
      return errorResponse(context, 404, "CREDIT_IDENTITY_NOT_FOUND", "No credit account was found for this user.");
    }

    const summary = await getRefundableCreditSummaryForTarget(target);
    const refundablePayments = summary?.payments ?? [];
    if (refundablePayments.length === 0) {
      return errorResponse(context, 409, "NO_REFUNDABLE_TOPUPS", "There are no unused purchased credits to refund.");
    }

    const stripe = getStripeClient();
    let refundedCredits = 0;
    let refundedAmount = 0;
    let currency = summary?.currency ?? null;

    for (const payment of refundablePayments) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.paymentIntentId,
          amount: payment.refundableAmount,
          reason: "requested_by_customer",
          metadata: {
            rubricheck_payment_id: String(payment.paymentId),
            rubricheck_credit_pack_id: payment.creditPackId ?? "",
            rubricheck_refunded_credits: String(payment.remainingCredits),
          },
        },
        {
          idempotencyKey: `rubricheck-credit-refund-${payment.paymentId}`,
        },
      );

      await markCreditPaymentRefunded({
        target,
        paymentId: payment.paymentId,
        stripeRefundId: refund.id,
        refundedCredits: payment.remainingCredits,
        refundedAmount: payment.refundableAmount,
        reason: "requested_by_customer",
      });

      refundedCredits += payment.remainingCredits;
      refundedAmount += payment.refundableAmount;
      currency = payment.currency;
    }

    return successJson(context, {
      ok: true,
      refundedCredits,
      refundedAmount,
      currency,
      message: `Refunded ${refundedCredits} unused top-up credits for ${formatCurrencyAmount(refundedAmount, currency)}.`,
    });
  } catch (error) {
    console.error("CREDIT_REFUND_FAILED", {
      requestId: context.requestId,
      error,
    });
    return errorResponse(context, 500, "CREDIT_REFUND_FAILED", "Unable to refund unused top-ups right now.");
  }
}
