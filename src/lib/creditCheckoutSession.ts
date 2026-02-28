import Stripe from "stripe";

export type CreditCheckoutSessionParamsInput = {
  priceId: string;
  appUrl: string;
  email: string;
  packId: string;
  lookupKey: string;
  customerId?: string | null;
};

export function buildCreditCheckoutSessionParams(
  params: CreditCheckoutSessionParamsInput,
): Stripe.Checkout.SessionCreateParams {
  const baseParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: `${params.appUrl}/?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.appUrl}/billing/cancel`,
    metadata: {
      purchase_type: "credits",
      credit_pack_id: params.packId,
      credit_pack_lookup_key: params.lookupKey,
    },
  };

  const customerId = params.customerId?.trim() ?? "";
  if (customerId) {
    return {
      ...baseParams,
      customer: customerId,
    };
  }

  return {
    ...baseParams,
    customer_email: params.email,
    customer_creation: "always",
  };
}
