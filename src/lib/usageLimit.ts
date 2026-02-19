import { Redis } from "@upstash/redis";

import { FREE_DAILY_LIMIT, PLUS_DAILY_LIMIT, type PlanName, getPlanFromUser } from "../config/plans";
import { getPlanFromEntitlementCookie } from "./entitlementSession";

export type UsageFeature = "evaluate" | "rewrite" | "simulate";

type UserPlanPayload = {
  plan?: string;
};

type FeatureLimitMap = Record<UsageFeature, number | null>;

export type UsageCheckResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  errorMessage?: string;
};

const WINDOW_SECONDS = 86400;

const PLAN_FEATURE_LIMITS: Record<PlanName, FeatureLimitMap> = {
  free: {
    evaluate: FREE_DAILY_LIMIT,
    rewrite: null,
    simulate: null,
  },
  plus: {
    evaluate: PLUS_DAILY_LIMIT,
    rewrite: PLUS_DAILY_LIMIT,
    simulate: PLUS_DAILY_LIMIT,
  },
  pro: {
    evaluate: PLUS_DAILY_LIMIT,
    rewrite: PLUS_DAILY_LIMIT,
    simulate: PLUS_DAILY_LIMIT,
  },
  semester: {
    evaluate: PLUS_DAILY_LIMIT,
    rewrite: PLUS_DAILY_LIMIT,
    simulate: PLUS_DAILY_LIMIT,
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

function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLimitForFeature(plan: PlanName, feature: UsageFeature): number | null {
  return PLAN_FEATURE_LIMITS[plan][feature];
}

function getFeatureBlockedMessage(feature: UsageFeature): string {
  const label = feature.charAt(0).toUpperCase() + feature.slice(1);
  return `${label} is a Pro feature. Upgrade to continue.`;
}

function getFreePlanLimitMessage(limit: number): string {
  return `Free daily limit reached (${limit}). Upgrade to continue.`;
}

async function resolveEffectivePlan(request: Request, user?: UserPlanPayload): Promise<PlanName> {
  const requestedPlan = getPlanFromUser(user);
  if (requestedPlan !== "free") {
    return requestedPlan;
  }

  try {
    const planFromCookie = getPlanFromEntitlementCookie(request);
    if (planFromCookie === "pro") {
      return "pro";
    }
  } catch {
    // Ignore malformed/missing cookie and fall back to free.
  }

  return "free";
}

export function buildUsageLimitHeaders(result: Pick<UsageCheckResult, "limit" | "remaining">): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}

export async function checkUsageLimit(
  request: Request,
  feature: UsageFeature,
  user?: UserPlanPayload,
): Promise<UsageCheckResult> {
  const effectivePlan = await resolveEffectivePlan(request, user);
  const limit = getLimitForFeature(effectivePlan, feature);

  if (limit === null || limit <= 0) {
    return {
      allowed: false,
      limit: 0,
      remaining: 0,
      errorMessage: getFeatureBlockedMessage(feature),
    };
  }

  if (!hasRedisConfig()) {
    if (process.env.NODE_ENV !== "production") {
      return {
        allowed: true,
        limit,
        remaining: limit,
      };
    }

    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

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
    errorMessage: allowed ? undefined : getFreePlanLimitMessage(limit),
  };
}
