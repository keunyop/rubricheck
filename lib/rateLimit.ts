import { Redis } from "@upstash/redis";
import { FREE_DAILY_LIMIT } from "../src/config/plans";

const DAILY_LIMIT = FREE_DAILY_LIMIT;
const WINDOW_SECONDS = 86400;

let redisClient: Redis | null = null;

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

function hasRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
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

export async function checkDailyRateLimit(
  request: Request,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  if (!hasRedisConfig()) {
    if (process.env.NODE_ENV !== "production") {
      return {
        allowed: true,
        remaining: DAILY_LIMIT,
        limit: DAILY_LIMIT,
      };
    }

    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  const redis = getRedisClient();
  const ip = getRequestIp(request);
  const key = `rubricheck:rl:${ip}:${getUtcDateKey()}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  return {
    allowed: count <= DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - count),
    limit: DAILY_LIMIT,
  };
}
