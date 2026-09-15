type MarkSessionProcessedFn = (sessionId: string) => Promise<boolean>;
type GrantCreditsFn = (params: {
  amount: number;
  customerId?: string | null;
  email?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  creditPackId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}) => Promise<number>;

export async function grantCreditsExactlyOnce(params: {
  sessionId: string;
  amount: number;
  customerId?: string | null;
  email?: string | null;
  paymentIntentId?: string | null;
  creditPackId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  markSessionProcessed: MarkSessionProcessedFn;
  grantCredits: GrantCreditsFn;
}): Promise<{ granted: boolean; amount: number }> {
  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_CREDIT_AMOUNT");
  }

  // The storage operation is idempotent by checkoutSessionId. Mark only after it succeeds.
  // A webhook/confirmation retry can then recover from an interrupted grant.
  await params.grantCredits({
    amount,
    customerId: params.customerId ?? null,
    email: params.email ?? null,
    checkoutSessionId: params.sessionId,
    paymentIntentId: params.paymentIntentId ?? null,
    creditPackId: params.creditPackId ?? null,
    amountTotal: params.amountTotal ?? null,
    currency: params.currency ?? null,
  });

  const isFirstProcess = await params.markSessionProcessed(params.sessionId);
  return { granted: isFirstProcess, amount: isFirstProcess ? amount : 0 };
}
