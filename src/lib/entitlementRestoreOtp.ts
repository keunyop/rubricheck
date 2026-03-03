import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Redis } from "@upstash/redis";

import { normalizeEmailInput } from "./entitlementRestoreShared";

const OTP_TTL_SECONDS = 60 * 10;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 10;
const MAX_SEND_PER_WINDOW = 5;
const MAX_VERIFY_PER_WINDOW = 5;
const MAX_VERIFY_FAILS_PER_CODE = 5;

const OTP_CODE_KEY_PREFIX = "rubricheck:restore:otp:code:";
const OTP_SEND_EMAIL_LIMIT_KEY_PREFIX = "rubricheck:restore:otp:send:email:";
const OTP_SEND_IP_LIMIT_KEY_PREFIX = "rubricheck:restore:otp:send:ip:";
const OTP_VERIFY_LIMIT_KEY_PREFIX = "rubricheck:restore:otp:verify:";

type OtpRecord = {
  codeHash: string;
  expiresAt: number;
  failedAttempts: number;
};

export type StartRestoreOtpResult = {
  devCode?: string;
};

type InMemoryRateLimitRecord = {
  count: number;
  expiresAt: number;
};

let redisClient: Redis | null = null;
const inMemoryOtpStore = new Map<string, OtpRecord>();
const inMemoryRateLimitStore = new Map<string, InMemoryRateLimitRecord>();
let hasWarnedAboutProductionInMemoryOtpFallback = false;

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

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

function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
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

function warnAboutProductionInMemoryOtpFallback(): void {
  if (!isProductionEnvironment() || hasWarnedAboutProductionInMemoryOtpFallback) {
    return;
  }

  hasWarnedAboutProductionInMemoryOtpFallback = true;
  console.warn("RESTORE_OTP_PRODUCTION_IN_MEMORY_FALLBACK");
}

function getRestoreSecret(): string {
  const secret =
    process.env.ENTITLEMENT_OTP_SECRET?.trim() ??
    process.env.ENTITLEMENT_SESSION_SECRET?.trim() ??
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ??
    "";

  if (!secret) {
    if (!isProductionEnvironment()) {
      return "rubricheck-dev-otp-secret";
    }
    throw new Error("ENTITLEMENT_OTP_SECRET_MISSING");
  }

  return secret;
}

function getOtpCodeKey(email: string): string {
  return `${OTP_CODE_KEY_PREFIX}${normalizeEmailInput(email)}`;
}

function getOtpSendEmailLimitKey(email: string): string {
  return `${OTP_SEND_EMAIL_LIMIT_KEY_PREFIX}${normalizeEmailInput(email)}`;
}

function getOtpSendIpLimitKey(ip: string): string {
  return `${OTP_SEND_IP_LIMIT_KEY_PREFIX}${ip}`;
}

function getOtpVerifyLimitKey(email: string, ip: string): string {
  return `${OTP_VERIFY_LIMIT_KEY_PREFIX}${normalizeEmailInput(email)}:${ip}`;
}

function hashOtpCode(email: string, code: string): string {
  return createHmac("sha256", getRestoreSecret())
    .update(`${normalizeEmailInput(email)}:${code}`)
    .digest("base64url");
}

function parseOtpRecord(value: unknown): OtpRecord | null {
  if (typeof value === "string") {
    try {
      return parseOtpRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as {
    codeHash?: unknown;
    expiresAt?: unknown;
    failedAttempts?: unknown;
  };

  if (typeof raw.codeHash !== "string" || !raw.codeHash.trim()) {
    return null;
  }

  if (typeof raw.expiresAt !== "number" || !Number.isFinite(raw.expiresAt)) {
    return null;
  }

  if (typeof raw.failedAttempts !== "number" || !Number.isFinite(raw.failedAttempts)) {
    return null;
  }

  return {
    codeHash: raw.codeHash,
    expiresAt: raw.expiresAt,
    failedAttempts: Math.max(0, Math.floor(raw.failedAttempts)),
  };
}

async function incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
  const redis = getRedisClient();
  const nextCount = await redis.incr(key);

  if (nextCount === 1) {
    await redis.expire(key, windowSeconds);
  }

  return nextCount;
}

function incrementRateLimitInMemory(key: string, windowSeconds: number): number {
  const nowSeconds = getNowSeconds();
  const existing = inMemoryRateLimitStore.get(key);
  if (!existing || existing.expiresAt <= nowSeconds) {
    inMemoryRateLimitStore.set(key, {
      count: 1,
      expiresAt: nowSeconds + windowSeconds,
    });
    return 1;
  }

  const nextCount = existing.count + 1;
  inMemoryRateLimitStore.set(key, {
    ...existing,
    count: nextCount,
  });
  return nextCount;
}

function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function isValidOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRestoreOtpEmail(email: string, code: string): { subject: string; text: string; html: string } {
  const subject = "Your RubriCheck sign-in code";
  const escapedEmail = escapeHtml(email);
  const escapedCode = escapeHtml(code);

  return {
    subject,
    text: [
      "RubriCheck sign-in verification",
      "",
      `Use this verification code to sign in to ${email}:`,
      "",
      code,
      "",
      "This code expires in 10 minutes.",
      "If you did not request this code, you can ignore this email.",
    ].join("\n"),
    html: `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">
            <tr>
              <td style="padding-bottom:16px;font-size:22px;line-height:1.2;font-weight:700;color:#111827;">
                RubriCheck
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 12px;font-size:24px;line-height:1.3;font-weight:700;color:#111827;">
                Your sign-in code
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                Use this verification code to sign in to <strong>${escapedEmail}</strong>.
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 20px;">
                <div style="display:inline-block;padding:12px 16px;border:1px solid #d1d5db;background-color:#f9fafb;font-size:32px;line-height:1;font-weight:700;letter-spacing:0.24em;color:#111827;">
                  ${escapedCode}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
                This code expires in <strong>10 minutes</strong>.
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.6;color:#4b5563;">
                If you did not request this code, you can ignore this email.
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px;font-size:12px;line-height:1.6;color:#9ca3af;">
                Sign-in verification email from RubriCheck
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const otpFromEmail = process.env.OTP_FROM_EMAIL?.trim();
  const isProduction = isProductionEnvironment();
  const message = buildRestoreOtpEmail(email, code);

  if (resendApiKey && otpFromEmail) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: otpFromEmail,
          to: [email],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });

      if (response.ok) {
        return;
      }

      if (!isProduction) {
        console.warn("RESTORE_OTP_DEV_EMAIL_FALLBACK", { email, status: response.status });
        console.info("RESTORE_OTP_DEV_SEND", { email });
        return;
      }
    } catch (error) {
      if (!isProduction) {
        console.warn("RESTORE_OTP_DEV_EMAIL_FALLBACK", { email, error });
        console.info("RESTORE_OTP_DEV_SEND", { email });
        return;
      }
    }

    if (isProduction) {
      throw new Error("OTP_EMAIL_SEND_FAILED");
    }
  }

  if (!isProduction) {
    console.info("RESTORE_OTP_DEV_SEND", { email });
    return;
  }

  throw new Error("OTP_EMAIL_PROVIDER_NOT_CONFIGURED");
}

export async function startRestoreOtp(request: Request, email: string): Promise<StartRestoreOtpResult> {
  const normalizedEmail = normalizeEmailInput(email);
  const ip = getRequestIp(request);

  if (!hasRedisConfig()) {
    warnAboutProductionInMemoryOtpFallback();

    const emailRateCount = incrementRateLimitInMemory(
      getOtpSendEmailLimitKey(normalizedEmail),
      RATE_LIMIT_WINDOW_SECONDS,
    );
    const ipRateCount = incrementRateLimitInMemory(
      getOtpSendIpLimitKey(ip),
      RATE_LIMIT_WINDOW_SECONDS,
    );

    if (emailRateCount > MAX_SEND_PER_WINDOW || ipRateCount > MAX_SEND_PER_WINDOW) {
      throw new Error("RESTORE_OTP_RATE_LIMITED");
    }

    const code = generateOtpCode();
    const nowSeconds = getNowSeconds();
    const record: OtpRecord = {
      codeHash: hashOtpCode(normalizedEmail, code),
      expiresAt: nowSeconds + OTP_TTL_SECONDS,
      failedAttempts: 0,
    };
    inMemoryOtpStore.set(getOtpCodeKey(normalizedEmail), record);
    await sendOtpEmail(normalizedEmail, code);
    return isProductionEnvironment() ? {} : { devCode: code };
  }

  const [emailRateCount, ipRateCount] = await Promise.all([
    incrementRateLimit(getOtpSendEmailLimitKey(normalizedEmail), RATE_LIMIT_WINDOW_SECONDS),
    incrementRateLimit(getOtpSendIpLimitKey(ip), RATE_LIMIT_WINDOW_SECONDS),
  ]);

  if (emailRateCount > MAX_SEND_PER_WINDOW || ipRateCount > MAX_SEND_PER_WINDOW) {
    throw new Error("RESTORE_OTP_RATE_LIMITED");
  }

  const code = generateOtpCode();
  const nowSeconds = getNowSeconds();

  const record: OtpRecord = {
    codeHash: hashOtpCode(normalizedEmail, code),
    expiresAt: nowSeconds + OTP_TTL_SECONDS,
    failedAttempts: 0,
  };

  await getRedisClient().set(getOtpCodeKey(normalizedEmail), record, {
    ex: OTP_TTL_SECONDS,
  });

  await sendOtpEmail(normalizedEmail, code);
  return isProductionEnvironment() ? {} : { devCode: code };
}

export async function verifyRestoreOtp(request: Request, email: string, code: string): Promise<boolean> {
  const normalizedEmail = normalizeEmailInput(email);
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  const ip = getRequestIp(request);

  if (!hasRedisConfig()) {
    warnAboutProductionInMemoryOtpFallback();

    const verifyCount = incrementRateLimitInMemory(
      getOtpVerifyLimitKey(normalizedEmail, ip),
      RATE_LIMIT_WINDOW_SECONDS,
    );
    if (verifyCount > MAX_VERIFY_PER_WINDOW) {
      throw new Error("RESTORE_OTP_RATE_LIMITED");
    }

    if (!isValidOtpCode(normalizedCode)) {
      return false;
    }

    const otpKey = getOtpCodeKey(normalizedEmail);
    const record = inMemoryOtpStore.get(otpKey);
    if (!record) {
      return false;
    }

    const nowSeconds = getNowSeconds();
    if (record.expiresAt < nowSeconds) {
      inMemoryOtpStore.delete(otpKey);
      return false;
    }

    if (record.failedAttempts >= MAX_VERIFY_FAILS_PER_CODE) {
      inMemoryOtpStore.delete(otpKey);
      return false;
    }

    const expectedHash = hashOtpCode(normalizedEmail, normalizedCode);
    const providedBuffer = Buffer.from(record.codeHash, "utf8");
    const expectedBuffer = Buffer.from(expectedHash, "utf8");
    const matches =
      providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);

    if (matches) {
      inMemoryOtpStore.delete(otpKey);
      return true;
    }

    inMemoryOtpStore.set(otpKey, {
      ...record,
      failedAttempts: record.failedAttempts + 1,
    });
    return false;
  }

  const verifyCount = await incrementRateLimit(
    getOtpVerifyLimitKey(normalizedEmail, ip),
    RATE_LIMIT_WINDOW_SECONDS,
  );
  if (verifyCount > MAX_VERIFY_PER_WINDOW) {
    throw new Error("RESTORE_OTP_RATE_LIMITED");
  }

  if (!isValidOtpCode(normalizedCode)) {
    return false;
  }

  const redis = getRedisClient();
  const otpKey = getOtpCodeKey(normalizedEmail);
  const rawRecord = await redis.get(otpKey);
  const record = parseOtpRecord(rawRecord);
  if (!record) {
    return false;
  }

  const nowSeconds = getNowSeconds();
  if (record.expiresAt < nowSeconds) {
    await redis.del(otpKey);
    return false;
  }

  if (record.failedAttempts >= MAX_VERIFY_FAILS_PER_CODE) {
    await redis.del(otpKey);
    return false;
  }

  const expectedHash = hashOtpCode(normalizedEmail, normalizedCode);
  const providedBuffer = Buffer.from(record.codeHash, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const matches =
    providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);

  if (matches) {
    await redis.del(otpKey);
    return true;
  }

  const remainingTtl = Math.max(1, record.expiresAt - nowSeconds);
  const nextRecord: OtpRecord = {
    ...record,
    failedAttempts: record.failedAttempts + 1,
  };
  await redis.set(otpKey, nextRecord, {
    ex: remainingTtl,
  });

  return false;
}
