type MarkSessionProcessedFn = (sessionId: string) => Promise<boolean>;
type GrantCreditsFn = (params: {
  amount: number;
  customerId?: string | null;
  email?: string | null;
}) => Promise<number>;

export async function grantCreditsExactlyOnce(params: {
  sessionId: string;
  amount: number;
  customerId?: string | null;
  email?: string | null;
  markSessionProcessed: MarkSessionProcessedFn;
  grantCredits: GrantCreditsFn;
}): Promise<{ granted: boolean; amount: number }> {
  const isFirstProcess = await params.markSessionProcessed(params.sessionId);
  if (!isFirstProcess) {
    return { granted: false, amount: 0 };
  }

  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_CREDIT_AMOUNT");
  }

  await params.grantCredits({
    amount,
    customerId: params.customerId ?? null,
    email: params.email ?? null,
  });

  return {
    granted: true,
    amount,
  };
}
