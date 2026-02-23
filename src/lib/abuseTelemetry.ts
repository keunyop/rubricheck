import { createHash, createHmac } from "node:crypto";

import { Redis } from "@upstash/redis";

export type AbuseEndpoint = "evaluate" | "otp_start" | "otp_verify" | "checkout_session";
export type AbuseOutcome = "success" | "error" | "suspicious";

export type AbuseTelemetryEvent = {
  requestId: string;
  endpoint: AbuseEndpoint;
  request: Request;
  outcome: "success" | "error";
  email?: string | null;
  latencyMs?: number;
  payloadSizeApprox?: number;
  fileType?: string;
  details?: Record<string, unknown>;
};

export type SuspicionEvaluationInput = {
  endpoint: AbuseEndpoint;
  uaLength: number;
  ratePerMinute: number;
  distinctEmailsPerIp10m: number;
  distinctIpsPerEmail10m: number;
  ipErrorTotal10m: number;
  ipRequestTotal10m: number;
};

export type SuspicionEvaluation = {
  score: number;
  reasons: string[];
  suspicious: boolean;
};

type RankedCount = { key: string; count: number };

type MetricsWindow = {
  totalRequestsByEndpoint: Record<AbuseEndpoint, number>;
  suspiciousRequestsByEndpoint: Record<AbuseEndpoint, number>;
  errorRequestsByEndpoint: Record<AbuseEndpoint, number>;
};

export type AbuseMetricsResponse = {
  generatedAt: string;
  enforcementMode: AbuseEnforcementMode;
  thresholds: typeof ABUSE_THRESHOLDS;
  last1h: MetricsWindow;
  last24h: MetricsWindow;
  topIpsByRequestCount: RankedCount[];
  topIpsBySuspiciousCount: RankedCount[];
  otpAnomalies: {
    ipsByDistinctEmails10m: RankedCount[];
    ipsByDistinctEmails1h: RankedCount[];
    emailsByDistinctIps10m: RankedCount[];
    emailsByDistinctIps1h: RankedCount[];
  };
  recentSuspiciousEvents: Array<{
    timestamp: string;
    requestId: string;
    endpoint: AbuseEndpoint;
    ipHash: string;
    uaShort: string;
    score: number;
    reasons: string[];
  }>;
};

export const ABUSE_THRESHOLDS = {
  evaluatePerMinute: 10,
  otpStartPerMinute: 3,
  otpVerifyPerMinute: 5,
  distinctEmailsPerIp10m: 5,
  distinctIpsPerEmail10m: 5,
  shortUserAgentLength: 12,
  highErrorRatioMinRequests10m: 6,
  highErrorRatio10m: 0.7,
  suspiciousScoreThreshold: 3,
} as const;

const KEY_PREFIX = "rubricheck:abuse:v1";
const ONE_HOUR_SECONDS = 60 * 60;
const TWENTY_FOUR_HOURS_SECONDS = 60 * 60 * 24;
const TEN_MINUTES_SECONDS = 60 * 10;
const TOP_N_DEFAULT = 15;
const RECENT_EVENTS_SIZE = 50;
const MAX_UA_LENGTH = 180;

export type AbuseEnforcementMode = "monitor" | "enforce";

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

function getHashSecret(): string {
  return (
    process.env.ABUSE_HASH_SECRET?.trim() ||
    process.env.ENTITLEMENT_OTP_SECRET?.trim() ||
    process.env.ENTITLEMENT_SESSION_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    "rubricheck-abuse-dev-secret"
  );
}

export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function truncateUserAgent(value: string | null | undefined): string {
  const ua = typeof value === "string" ? value.trim() : "";
  if (!ua) return "";
  return ua.length <= MAX_UA_LENGTH ? ua : ua.slice(0, MAX_UA_LENGTH);
}

export function normalizeEmailForHash(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function stableHash(value: string): string {
  if (!value) return "";
  return createHmac("sha256", getHashSecret()).update(value).digest("hex").slice(0, 24);
}

export function hashEmail(value: string | null | undefined): string {
  const normalized = normalizeEmailForHash(value);
  if (!normalized) return "";
  return stableHash(`email:${normalized}`);
}

function hashIp(ip: string): string {
  return stableHash(`ip:${ip}`);
}

function minuteBucketKey(): string {
  return Math.floor(Date.now() / 60_000).toString();
}

function getRateThreshold(endpoint: AbuseEndpoint): number {
  if (endpoint === "evaluate") return ABUSE_THRESHOLDS.evaluatePerMinute;
  if (endpoint === "otp_start") return ABUSE_THRESHOLDS.otpStartPerMinute;
  if (endpoint === "otp_verify") return ABUSE_THRESHOLDS.otpVerifyPerMinute;
  return 20;
}

export function evaluateSuspicion(input: SuspicionEvaluationInput): SuspicionEvaluation {
  const reasons: string[] = [];
  let score = 0;

  if (input.ratePerMinute > getRateThreshold(input.endpoint)) {
    score += 2;
    reasons.push("high_rate_same_ip");
  }

  if (input.endpoint === "otp_start" && input.distinctEmailsPerIp10m >= ABUSE_THRESHOLDS.distinctEmailsPerIp10m) {
    score += 2;
    reasons.push("many_distinct_emails_per_ip");
  }

  if ((input.endpoint === "otp_start" || input.endpoint === "otp_verify") && input.distinctIpsPerEmail10m >= ABUSE_THRESHOLDS.distinctIpsPerEmail10m) {
    score += 2;
    reasons.push("many_ips_per_email");
  }

  if (input.uaLength < ABUSE_THRESHOLDS.shortUserAgentLength) {
    score += 1;
    reasons.push("unusual_user_agent");
  }

  if (
    input.ipRequestTotal10m >= ABUSE_THRESHOLDS.highErrorRatioMinRequests10m &&
    input.ipErrorTotal10m / input.ipRequestTotal10m >= ABUSE_THRESHOLDS.highErrorRatio10m
  ) {
    score += 1;
    reasons.push("high_error_ratio");
  }

  return {
    score,
    reasons,
    suspicious: score >= ABUSE_THRESHOLDS.suspiciousScoreThreshold,
  };
}

function getMode(): AbuseEnforcementMode {
  return process.env.ABUSE_ENFORCEMENT_MODE === "enforce" ? "enforce" : "monitor";
}

async function readTopFromZSet(redis: Redis, key: string, limit = TOP_N_DEFAULT): Promise<RankedCount[]> {
  const rows = await redis.zrange(key, 0, limit - 1, { rev: true, withScores: true }) as string[];
  const result: RankedCount[] = [];

  for (let index = 0; index < rows.length; index += 2) {
    const member = rows[index];
    const score = Number(rows[index + 1]);
    if (!member || !Number.isFinite(score)) continue;
    result.push({ key: member, count: Math.floor(score) });
  }

  return result;
}

function defaultWindowMetrics(): MetricsWindow {
  return {
    totalRequestsByEndpoint: { evaluate: 0, otp_start: 0, otp_verify: 0, checkout_session: 0 },
    suspiciousRequestsByEndpoint: { evaluate: 0, otp_start: 0, otp_verify: 0, checkout_session: 0 },
    errorRequestsByEndpoint: { evaluate: 0, otp_start: 0, otp_verify: 0, checkout_session: 0 },
  };
}

function parseWindowMetrics(raw: Record<string, string> | null | undefined): MetricsWindow {
  const metrics = defaultWindowMetrics();
  if (!raw) return metrics;

  (Object.keys(metrics.totalRequestsByEndpoint) as AbuseEndpoint[]).forEach((endpoint) => {
    metrics.totalRequestsByEndpoint[endpoint] = Number(raw[`${endpoint}:total`] ?? 0);
    metrics.suspiciousRequestsByEndpoint[endpoint] = Number(raw[`${endpoint}:suspicious`] ?? 0);
    metrics.errorRequestsByEndpoint[endpoint] = Number(raw[`${endpoint}:error`] ?? 0);
  });

  return metrics;
}

function parseRecentEvent(raw: string): AbuseMetricsResponse["recentSuspiciousEvents"][number] | null {
  try {
    const parsed = JSON.parse(raw) as AbuseMetricsResponse["recentSuspiciousEvents"][number];
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function shouldEnforceForSuspicious(suspicious: boolean): boolean {
  return getMode() === "enforce" && suspicious;
}

export async function recordAbuseTelemetry(event: AbuseTelemetryEvent): Promise<{
  requestId: string;
  ipHash: string;
  emailHash: string;
  uaShort: string;
  suspicious: boolean;
  score: number;
  reasons: string[];
  mode: AbuseEnforcementMode;
}> {
  const timestamp = new Date().toISOString();
  const ip = extractClientIp(event.request);
  const uaShort = truncateUserAgent(event.request.headers.get("user-agent"));
  const ipHash = hashIp(ip);
  const emailHash = hashEmail(event.email);

  const mode = getMode();

  if (!hasRedisConfig()) {
    return { requestId: event.requestId, ipHash, emailHash, uaShort, suspicious: false, score: 0, reasons: [], mode };
  }

  const redis = getRedisClient();
  const minuteKey = `${KEY_PREFIX}:rate:1m:${event.endpoint}:${ipHash}:${minuteBucketKey()}`;
  const ratePerMinute = await redis.incr(minuteKey);
  if (ratePerMinute === 1) {
    await redis.expire(minuteKey, 90);
  }

  const otpIpDistinct10mKey = `${KEY_PREFIX}:otp:ipEmails:10m:${ipHash}`;
  const otpEmailDistinct10mKey = `${KEY_PREFIX}:otp:emailIps:10m:${emailHash}`;
  const otpIpDistinct1hKey = `${KEY_PREFIX}:otp:ipEmails:1h:${ipHash}`;
  const otpEmailDistinct1hKey = `${KEY_PREFIX}:otp:emailIps:1h:${emailHash}`;

  let distinctEmailsPerIp10m = 0;
  let distinctIpsPerEmail10m = 0;

  if ((event.endpoint === "otp_start" || event.endpoint === "otp_verify") && emailHash) {
    await redis.sadd(otpIpDistinct10mKey, emailHash);
    await redis.sadd(otpEmailDistinct10mKey, ipHash);
    await redis.expire(otpIpDistinct10mKey, TEN_MINUTES_SECONDS);
    await redis.expire(otpEmailDistinct10mKey, TEN_MINUTES_SECONDS);

    await redis.sadd(otpIpDistinct1hKey, emailHash);
    await redis.sadd(otpEmailDistinct1hKey, ipHash);
    await redis.expire(otpIpDistinct1hKey, ONE_HOUR_SECONDS);
    await redis.expire(otpEmailDistinct1hKey, ONE_HOUR_SECONDS);

    [distinctEmailsPerIp10m, distinctIpsPerEmail10m] = await Promise.all([
      redis.scard(otpIpDistinct10mKey),
      redis.scard(otpEmailDistinct10mKey),
    ]);

    await Promise.all([
      redis.zadd(`${KEY_PREFIX}:rank:otp:ipDistinctEmails:10m`, { score: distinctEmailsPerIp10m, member: ipHash }),
      redis.expire(`${KEY_PREFIX}:rank:otp:ipDistinctEmails:10m`, TEN_MINUTES_SECONDS),
      redis.zadd(`${KEY_PREFIX}:rank:otp:ipDistinctEmails:1h`, { score: await redis.scard(otpIpDistinct1hKey), member: ipHash }),
      redis.expire(`${KEY_PREFIX}:rank:otp:ipDistinctEmails:1h`, ONE_HOUR_SECONDS),
      redis.zadd(`${KEY_PREFIX}:rank:otp:emailDistinctIps:10m`, { score: distinctIpsPerEmail10m, member: emailHash }),
      redis.expire(`${KEY_PREFIX}:rank:otp:emailDistinctIps:10m`, TEN_MINUTES_SECONDS),
      redis.zadd(`${KEY_PREFIX}:rank:otp:emailDistinctIps:1h`, { score: await redis.scard(otpEmailDistinct1hKey), member: emailHash }),
      redis.expire(`${KEY_PREFIX}:rank:otp:emailDistinctIps:1h`, ONE_HOUR_SECONDS),
    ]);
  }

  const statusWindowErrorKey = `${KEY_PREFIX}:ip:error:10m:${ipHash}`;
  const statusWindowTotalKey = `${KEY_PREFIX}:ip:total:10m:${ipHash}`;

  await redis.incr(statusWindowTotalKey);
  await redis.expire(statusWindowTotalKey, TEN_MINUTES_SECONDS);
  if (event.outcome === "error") {
    await redis.incr(statusWindowErrorKey);
    await redis.expire(statusWindowErrorKey, TEN_MINUTES_SECONDS);
  }

  const [ipErrorTotal10m, ipRequestTotal10m] = await Promise.all([
    Number(await redis.get(statusWindowErrorKey)) || 0,
    Number(await redis.get(statusWindowTotalKey)) || 0,
  ]);

  const suspicion = evaluateSuspicion({
    endpoint: event.endpoint,
    uaLength: uaShort.length,
    ratePerMinute,
    distinctEmailsPerIp10m,
    distinctIpsPerEmail10m,
    ipErrorTotal10m,
    ipRequestTotal10m,
  });

  const finalOutcome: AbuseOutcome = suspicion.suspicious ? "suspicious" : event.outcome;

  for (const [window, ttl] of [["1h", ONE_HOUR_SECONDS], ["24h", TWENTY_FOUR_HOURS_SECONDS]] as const) {
    const summaryKey = `${KEY_PREFIX}:summary:${window}`;
    await redis.hincrby(summaryKey, `${event.endpoint}:total`, 1);
    await redis.hincrby(summaryKey, `${event.endpoint}:${finalOutcome}`, 1);
    if (event.outcome === "error" && finalOutcome !== "error") {
      await redis.hincrby(summaryKey, `${event.endpoint}:error`, 1);
    }
    await redis.expire(summaryKey, ttl);

    await redis.incr(`${KEY_PREFIX}:ip:req:${window}:${ipHash}`);
    await redis.expire(`${KEY_PREFIX}:ip:req:${window}:${ipHash}`, ttl);
    await redis.zincrby(`${KEY_PREFIX}:rank:req:${window}`, 1, ipHash);
    await redis.expire(`${KEY_PREFIX}:rank:req:${window}`, ttl);

    if (finalOutcome === "suspicious") {
      await redis.incr(`${KEY_PREFIX}:ip:susp:${window}:${ipHash}`);
      await redis.expire(`${KEY_PREFIX}:ip:susp:${window}:${ipHash}`, ttl);
      await redis.zincrby(`${KEY_PREFIX}:rank:susp:${window}`, 1, ipHash);
      await redis.expire(`${KEY_PREFIX}:rank:susp:${window}`, ttl);
    }
  }

  if (finalOutcome === "suspicious") {
    const eventPayload = {
      timestamp,
      requestId: event.requestId,
      endpoint: event.endpoint,
      ipHash,
      uaShort,
      score: suspicion.score,
      reasons: suspicion.reasons,
    };
    await redis.lpush(`${KEY_PREFIX}:events:suspicious`, JSON.stringify(eventPayload));
    await redis.ltrim(`${KEY_PREFIX}:events:suspicious`, 0, RECENT_EVENTS_SIZE - 1);
    await redis.expire(`${KEY_PREFIX}:events:suspicious`, TWENTY_FOUR_HOURS_SECONDS);
  }

  console.info("ABUSE_TELEMETRY", {
    requestId: event.requestId,
    endpoint: event.endpoint,
    status: event.outcome,
    suspicionScore: suspicion.score,
    reasons: suspicion.reasons,
  });

  return {
    requestId: event.requestId,
    ipHash,
    emailHash,
    uaShort,
    suspicious: suspicion.suspicious,
    score: suspicion.score,
    reasons: suspicion.reasons,
    mode,
  };
}

export async function getAbuseMetrics(): Promise<AbuseMetricsResponse> {
  if (!hasRedisConfig()) {
    return {
      generatedAt: new Date().toISOString(),
      enforcementMode: getMode(),
      thresholds: ABUSE_THRESHOLDS,
      last1h: defaultWindowMetrics(),
      last24h: defaultWindowMetrics(),
      topIpsByRequestCount: [],
      topIpsBySuspiciousCount: [],
      otpAnomalies: {
        ipsByDistinctEmails10m: [],
        ipsByDistinctEmails1h: [],
        emailsByDistinctIps10m: [],
        emailsByDistinctIps1h: [],
      },
      recentSuspiciousEvents: [],
    };
  }

  const redis = getRedisClient();
  const [window1h, window24h, topReq, topSusp, ipEmails10m, ipEmails1h, emailIps10m, emailIps1h, recentEvents] = await Promise.all([
    redis.hgetall<Record<string, string>>(`${KEY_PREFIX}:summary:1h`),
    redis.hgetall<Record<string, string>>(`${KEY_PREFIX}:summary:24h`),
    readTopFromZSet(redis, `${KEY_PREFIX}:rank:req:1h`),
    readTopFromZSet(redis, `${KEY_PREFIX}:rank:susp:1h`),
    readTopFromZSet(redis, `${KEY_PREFIX}:rank:otp:ipDistinctEmails:10m`),
    readTopFromZSet(redis, `${KEY_PREFIX}:rank:otp:ipDistinctEmails:1h`),
    readTopFromZSet(redis, `${KEY_PREFIX}:rank:otp:emailDistinctIps:10m`),
    readTopFromZSet(redis, `${KEY_PREFIX}:rank:otp:emailDistinctIps:1h`),
    redis.lrange(`${KEY_PREFIX}:events:suspicious`, 0, RECENT_EVENTS_SIZE - 1) as Promise<string[]>,
  ]);

  return {
    generatedAt: new Date().toISOString(),
    enforcementMode: getMode(),
    thresholds: ABUSE_THRESHOLDS,
    last1h: parseWindowMetrics(window1h),
    last24h: parseWindowMetrics(window24h),
    topIpsByRequestCount: topReq,
    topIpsBySuspiciousCount: topSusp,
    otpAnomalies: {
      ipsByDistinctEmails10m: ipEmails10m,
      ipsByDistinctEmails1h: ipEmails1h,
      emailsByDistinctIps10m: emailIps10m,
      emailsByDistinctIps1h: emailIps1h,
    },
    recentSuspiciousEvents: recentEvents.map(parseRecentEvent).filter((event): event is NonNullable<typeof event> => Boolean(event)),
  };
}

export function getPayloadSizeApprox(request: Request): number {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 0) return Math.floor(contentLength);

  const type = request.headers.get("content-type") || "";
  return createHash("sha1").update(type).digest().at(0) ?? 0;
}
