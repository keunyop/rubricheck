type BillingSource = "free" | "pro" | "credit" | undefined;

export function shouldRefundReservedEvaluateCredit(params: {
  billingSource: BillingSource;
  hasReservation: boolean;
  evaluationSucceeded: boolean;
}): boolean {
  if (params.evaluationSucceeded) {
    return false;
  }

  if (!params.hasReservation) {
    return false;
  }

  return params.billingSource === "credit";
}
