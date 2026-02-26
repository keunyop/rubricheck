import { Redis } from "@upstash/redis";

import { FREE_DAILY_LIMIT } from "../../../../src/config/plans";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getCreditBalanceForRequest } from "../../../../src/lib/credits";
import { getEntitlementEmailFromCookie, getPlanFromEntitlementCookie } from "../../../../src/lib/entitlementSession";

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
    const ip = getRequestIp(request);
    const featureKey = plan === "pro" ? "evaluate" : "evaluate_free";
    const key = `rubricheck:usage:${ip}:${getUtcDateKey()}:${featureKey}`;
    const rawCount = await getRedisClient().get(key);
    return parseCount(rawCount);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const context = createRequestContext(request);

  try {
    const entitlementEmail = getEntitlementEmailFromCookie(request);
    const creditEmail = getCreditEmailFromCookie(request);
    const email = entitlementEmail ?? creditEmail;
    const signedIn = Boolean(email);

    if (!signedIn) {
      return successJson(context, {
        signedIn: false,
        email: null,
        plan: "free",
        remainingEvaluations: null,
        creditsBalance: null,
      });
    }

    const plan = getPlanFromEntitlementCookie(request) === "pro" ? "pro" : "free";
    const usageCount = plan === "free" ? await readEvaluateUsageCount(request, plan) : null;
    const remainingByPlan = usageCount === null ? null : Math.max(0, FREE_DAILY_LIMIT - usageCount);
    const creditsBalance = await getCreditBalanceForRequest(request);
    const normalizedCreditsBalance =
      typeof creditsBalance === "number" && Number.isFinite(creditsBalance) ? Math.max(0, creditsBalance) : null;

    const remainingEvaluations =
      remainingByPlan === null
        ? plan === "free"
          ? normalizedCreditsBalance
          : null
        : plan === "free"
          ? remainingByPlan + (normalizedCreditsBalance ?? 0)
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
