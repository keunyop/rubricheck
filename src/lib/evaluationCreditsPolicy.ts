export type EvaluateAccessDecision =
  | {
      allowed: true;
      source: "free";
      consumeCredit: false;
    }
  | {
      allowed: true;
      source: "credit";
      consumeCredit: true;
    }
  | {
      allowed: false;
      source: "blocked";
      consumeCredit: false;
      errorCode: "FREE_LIMIT_REACHED";
    };

export function decideFreeEvaluateAccess(params: {
  freeCount: number;
  freeLimit: number;
  creditsAvailable: number;
}): EvaluateAccessDecision {
  if (params.freeCount <= params.freeLimit) {
    return {
      allowed: true,
      source: "free",
      consumeCredit: false,
    };
  }

  if (params.creditsAvailable > 0) {
    return {
      allowed: true,
      source: "credit",
      consumeCredit: true,
    };
  }

  return {
    allowed: false,
    source: "blocked",
    consumeCredit: false,
    errorCode: "FREE_LIMIT_REACHED",
  };
}
