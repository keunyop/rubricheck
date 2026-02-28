import { Redis } from "@upstash/redis";

import { FREE_TRIAL_LIMIT } from "../../../../src/config/plans";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getCreditBalanceForRequest } from "../../../../src/lib/credits";
import { getFreeUsageActor } from "../../../../src/lib/freeUsageActor";
import {
  getAccountEntitlementByEmail,
  hasAccountEntitlementStore,
  isAccountEntitlementStoreUnavailableError,
  isActiveProAccountEntitlement,
} from "../../../../src/lib/accountEntitlements";

export const runtime = "nodejs";

let redisClient: Redis | null = null;

function hasRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token);
}

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

async function readEvaluateUsageCount(request: Request, plan: "free" | "pro"): Promise<number | null> {
  if (!hasRedisConfig()) {
    return null;
  }

  try {
    if (plan !== "free") {
      return null;
    }
    const actor = getFreeUsageActor(request);
    const key = `rubricheck:usage:${actor}:evaluate_free`;
    const rawCount = await getRedisClient().get(key);
    return parseCount(rawCount);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const context = createRequestContext(request);

  try {
    const creditEmail = getCreditEmailFromCookie(request);
    const creditsBalance = await getCreditBalanceForRequest(request);
    const normalizedCreditsBalance =
      typeof creditsBalance === "number" && Number.isFinite(creditsBalance) ? Math.max(0, creditsBalance) : null;
    const email = creditEmail ?? null;
    const signedIn = Boolean(email);
    const anonymousUsageCount = !signedIn ? await readEvaluateUsageCount(request, "free") : null;
    const anonymousRemainingEvaluations =
      anonymousUsageCount === null ? null : Math.max(0, FREE_TRIAL_LIMIT - anonymousUsageCount);

    if (!signedIn) {
      return successJson(context, {
        signedIn: false,
        email: null,
        plan: "free",
        remainingEvaluations: anonymousRemainingEvaluations,
        creditsBalance: normalizedCreditsBalance,
      });
    }

    let plan: "free" | "pro" = "free";
    if (email && hasAccountEntitlementStore()) {
      try {
        const entitlement = await getAccountEntitlementByEmail(email);
        plan = isActiveProAccountEntitlement(entitlement) ? "pro" : "free";
      } catch (lookupError) {
        if (!isAccountEntitlementStoreUnavailableError(lookupError)) {
          console.error("ACCOUNT_SUMMARY_ENTITLEMENT_LOOKUP_FAILED", {
            requestId: context.requestId,
            lookupError,
          });
        }
      }
    }

    const usageCount = plan === "free" ? await readEvaluateUsageCount(request, plan) : null;
    const remainingByPlan = usageCount === null ? null : Math.max(0, FREE_TRIAL_LIMIT - usageCount);

    const remainingEvaluations =
      plan === "free"
        ? remainingByPlan === null
          ? normalizedCreditsBalance
          : remainingByPlan + Math.max(0, normalizedCreditsBalance ?? 0)
        : remainingByPlan;

    return successJson(context, {
      signedIn: true,
      email,
      plan,
      remainingEvaluations,
      creditsBalance: normalizedCreditsBalance,
    });
  } catch (error) {
    console.error("ACCOUNT_SUMMARY_FETCH_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "ACCOUNT_SUMMARY_FETCH_FAILED", "Unable to load account summary right now.");
  }
}
