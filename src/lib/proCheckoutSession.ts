import type Stripe from "stripe";
import type { ProCheckoutPlan } from "../config/proCheckout";
import { evaluationCheckoutFields } from "./evaluationCheckout";

export function buildProCheckoutSessionParams(params: {
  plan: ProCheckoutPlan;
  priceId: string;
  email: string;
  appUrl: string;
  evaluationId: string | null;
}): Stripe.Checkout.SessionCreateParams {
  const lifetime = params.plan === "lifetime";
  return {
    mode: lifetime ? "payment" : "subscription",
    // Keep lifetime payments on a separate customer so an older recurring
    // subscription's cancellation can never replace the lifetime entitlement.
    ...(lifetime ? { customer_creation: "always", payment_method_types: ["card"], adaptive_pricing: { enabled: false } } : {}),
    line_items: [{ price: params.priceId, quantity: 1 }],
    customer_email: params.email,
    ...evaluationCheckoutFields(params.appUrl, params.evaluationId),
    metadata: { pro_plan: params.plan, ...(params.evaluationId ? { evaluation_id: params.evaluationId } : {}) },
  };
}
