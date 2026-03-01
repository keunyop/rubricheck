import { Redis } from "@upstash/redis";

import { FREE_TRIAL_LIMIT, PLUS_DAILY_LIMIT, type PlanName, getPlanFromUser } from "../config/plans.ts";
import {
  FREE_LIMIT_REACHED_CODE,
  SHOW_INTERSTITIAL_ACTION,
} from "./evaluateLimitPayload.ts";
import { canUseCreditsForFeature } from "./evaluationFeatureBilling.ts";
import {
  getCreditBalanceForRequest,
  refundCreditReservation,
  reserveOneCreditForRequest,
  type CreditReservation,
} from "./credits.ts";
import { getCreditEmailFromCookie } from "./creditSession.ts";
import { decideFreeEvaluateAccess } from "./evaluationCreditsPolicy.ts";
import { getFreeUsageActor, getRequestIp } from "./freeUsageActor.ts";
import {
  getAccountEntitlementByEmail,
  hasAccountEntitlementStore,
  isActiveProAccountEntitlement,
} from "./accountEntitlements.ts";

export type UsageFeature = "evaluate" | "rewrite";
export type UsageAction = typeof SHOW_INTERSTITIAL_ACTION;

type UserPlanPayload = {
  plan?: string;
};

type PlanFeatureLimit = number | "unlimited" | null;
type FeatureLimitMap = Record<UsageFeature, PlanFeatureLimit>;

export type UsageErrorCode = typeof FREE_LIMIT_REACHED_CODE | "REDIS_UNAVAILABLE";

export type UsageCheckResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  errorMessage?: string;
  errorCode?: UsageErrorCode;
  action?: UsageAction;
  creditsBalance?: number | null;
  plan?: PlanName;
  billingSource?: "free" | "pro" | "credit";
  creditReservation?: CreditReservation;
  degradedCode?: "REDIS_UNAVAILABLE";
};

const WINDOW_SECONDS = 86400;
const UNLIMITED_PLAN_SENTINEL = -1;

const REDIS_FALLBACK_LIMIT = 2;
const fallbackCounters = new Map<string, number>();

export function checkRedisFallbackAllowance(request: Request, feature: UsageFeature): {
  allowed: boolean;
  limit: number;
  remaining: number;
} {
  const key = `rubricheck:fallback:${getRequestIp(request)}:${getUtcDateKey()}:${feature}`;
  const next = (fallbackCounters.get(key) ?? 0) + 1;
  fallbackCounters.set(key, next);

  const allowed = next <= REDIS_FALLBACK_LIMIT;
  return {
    allowed,
    limit: REDIS_FALLBACK_LIMIT,
    remaining: Math.max(0, REDIS_FALLBACK_LIMIT - next),
  };
}

const PLAN_FEATURE_LIMITS: Record<PlanName, FeatureLimitMap> = {
  free: {
    evaluate: FREE_TRIAL_LIMIT,
    rewrite: null,
  },
  plus: {
    evaluate: PLUS_DAILY_LIMIT,
    rewrite: PLUS_DAILY_LIMIT,
  },
  pro: {
    evaluate: "unlimited",
    rewrite: "unlimited",
  },
  semester: {
    evaluate: PLUS_DAILY_LIMIT,
    rewrite: PLUS_DAILY_LIMIT,
  },
};

let redisClient: Redis | null = null;

function hasRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getFreeEvaluateUsageKey(request: Request): string {
  const actor = getFreeUsageActor(request);
  return `rubricheck:usage:${actor}:evaluate_free`;
}

function getLimitForFeature(plan: PlanName, feature: UsageFeature): PlanFeatureLimit {
  return PLAN_FEATURE_LIMITS[plan][feature];
}

function getFeatureBlockedMessage(feature: UsageFeature): string {
  const label = feature.charAt(0).toUpperCase() + feature.slice(1);
  return `${label} is a Pro feature. Log in or upgrade to continue.`;
}

function getFreePlanLimitMessage(limit: number): string {
  return `Free trial limit reached (${limit}). Upgrade to continue.`;
}

async function resolveEffectivePlan(request: Request, user?: UserPlanPayload): Promise<PlanName> {
  const requestedPlan = getPlanFromUser(user);
  if (requestedPlan !== "free") {
    return requestedPlan;
  }

  const signedInEmail = getCreditEmailFromCookie(request);
  if (signedInEmail && hasAccountEntitlementStore()) {
    try {
      const entitlement = await getAccountEntitlementByEmail(signedInEmail);
      return isActiveProAccountEntitlement(entitlement) ? "pro" : "free";
    } catch {
      return "free";
    }
  }

  return "free";
}

async function checkPlanLimitedFeature(
  request: Request,
  feature: UsageFeature,
  plan: PlanName,
): Promise<UsageCheckResult> {
  const limit = getLimitForFeature(plan, feature);

  if (limit === "unlimited") {
    return {
      allowed: true,
      limit: UNLIMITED_PLAN_SENTINEL,
      remaining: UNLIMITED_PLAN_SENTINEL,
      plan,
      billingSource: "pro",
    };
  }

  if (limit === null || limit <= 0) {
    return {
      allowed: false,
      limit: 0,
      remaining: 0,
      plan,
      billingSource: plan === "free" ? "free" : "pro",
      errorMessage: getFeatureBlockedMessage(feature),
    };
  }

  if (!hasRedisConfig()) {
    if (process.env.NODE_ENV !== "production") {
      return {
        allowed: true,
        limit,
        remaining: limit,
        plan,
        billingSource: plan === "free" ? "free" : "pro",
      };
    }

    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  try {
    const redis = getRedisClient();
    const ip = getRequestIp(request);
    const key = `rubricheck:usage:${ip}:${getUtcDateKey()}:${feature}`;

    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      limit,
      remaining,
      plan,
      billingSource: plan === "free" ? "free" : "pro",
      errorMessage: allowed ? undefined : getFreePlanLimitMessage(limit),
    };
  } catch {
    const fallback = checkRedisFallbackAllowance(request, feature);
    return {
      allowed: fallback.allowed,
      limit: fallback.limit,
      remaining: fallback.remaining,
      plan,
      billingSource: plan === "free" ? "free" : "pro",
      degradedCode: "REDIS_UNAVAILABLE",
      errorCode: fallback.allowed ? undefined : "REDIS_UNAVAILABLE",
      errorMessage: fallback.allowed
        ? "Usage checks are running in limited mode while we reconnect."
        : "Service is busy verifying usage right now. Please retry shortly.",
    };
  }
}

async function checkFreeEvaluateWithCredits(request: Request): Promise<UsageCheckResult> {
  if (!hasRedisConfig()) {
    if (process.env.NODE_ENV !== "production") {
      return {
        allowed: true,
        limit: FREE_TRIAL_LIMIT,
        remaining: FREE_TRIAL_LIMIT,
        plan: "free",
        billingSource: "free",
        creditsBalance: null,
      };
    }

    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  try {
    const redis = getRedisClient();
    const currentCreditBalance = Math.max(0, (await getCreditBalanceForRequest(request)) ?? 0);

    const freeKey = getFreeEvaluateUsageKey(request);
    const rawFreeCount = await redis.get(freeKey);
    const freeCountBefore = typeof rawFreeCount === "number" ? Math.max(0, Math.floor(rawFreeCount)) : Number.parseInt(String(rawFreeCount ?? "0"), 10) || 0;

    const freeDecision = decideFreeEvaluateAccess({
      freeCount: freeCountBefore + 1,
      freeLimit: FREE_TRIAL_LIMIT,
      creditsAvailable: currentCreditBalance,
    });

    if (freeDecision.allowed && freeDecision.source === "free") {
      const freeCount = await redis.incr(freeKey);
      return {
        allowed: true,
        limit: FREE_TRIAL_LIMIT,
        remaining: Math.max(0, FREE_TRIAL_LIMIT - freeCount),
        plan: "free",
        billingSource: "free",
        creditsBalance: currentCreditBalance,
      };
    }

    if (freeDecision.allowed && freeDecision.source === "credit") {
      const creditReservation = await reserveOneCreditForRequest(request);
      if (creditReservation.reserved && creditReservation.reservation) {
        return {
          allowed: true,
          limit: FREE_TRIAL_LIMIT,
          remaining: 0,
          plan: "free",
          billingSource: "credit",
          creditsBalance: creditReservation.balanceAfter,
          creditReservation: creditReservation.reservation,
        };
      }

      return {
        allowed: false,
        limit: FREE_TRIAL_LIMIT,
        remaining: 0,
        plan: "free",
        billingSource: "free",
        errorCode: "FREE_LIMIT_REACHED",
        action: "SHOW_INTERSTITIAL",
        errorMessage: getFreePlanLimitMessage(FREE_TRIAL_LIMIT),
        creditsBalance: creditReservation.balanceAfter,
      };
    }

    return {
      allowed: false,
      limit: FREE_TRIAL_LIMIT,
      remaining: 0,
      plan: "free",
      billingSource: "free",
      errorCode: "FREE_LIMIT_REACHED",
      action: "SHOW_INTERSTITIAL",
      errorMessage: getFreePlanLimitMessage(FREE_TRIAL_LIMIT),
      creditsBalance: currentCreditBalance,
    };
  } catch {
    const fallback = checkRedisFallbackAllowance(request, "evaluate");
    return {
      allowed: fallback.allowed,
      limit: fallback.limit,
      remaining: fallback.remaining,
      plan: "free",
      billingSource: "free",
      creditsBalance: null,
      degradedCode: "REDIS_UNAVAILABLE",
      errorCode: fallback.allowed ? undefined : "REDIS_UNAVAILABLE",
      errorMessage: fallback.allowed
        ? "Usage checks are running in limited mode while we reconnect."
        : "Service is busy verifying usage right now. Please retry shortly.",
    };
  }
}

export function buildUsageLimitHeaders(result: Pick<UsageCheckResult, "limit" | "remaining" | "creditsBalance">): Record<string, string> {
  const headers: Record<string, string> = {};

  if (result.limit > 0 && result.remaining >= 0) {
    headers["X-RateLimit-Limit"] = String(result.limit);
    headers["X-RateLimit-Remaining"] = String(result.remaining);
  }

  if (typeof result.creditsBalance === "number" && Number.isFinite(result.creditsBalance)) {
    headers["X-Credits-Balance"] = String(Math.max(0, Math.floor(result.creditsBalance)));
  }

  return headers;
}

export async function refundUsageCreditReservation(result: UsageCheckResult): Promise<number | null> {
  if (!result.creditReservation) {
    return null;
  }

  return refundCreditReservation(result.creditReservation);
}

export async function checkUsageLimit(
  request: Request,
  feature: UsageFeature,
  user?: UserPlanPayload,
): Promise<UsageCheckResult> {
  const effectivePlan = await resolveEffectivePlan(request, user);

  if (!canUseCreditsForFeature(feature)) {
    return checkPlanLimitedFeature(request, feature, effectivePlan);
  }

  if (effectivePlan === "free") {
    return checkFreeEvaluateWithCredits(request);
  }

  return checkPlanLimitedFeature(request, feature, effectivePlan);
}
