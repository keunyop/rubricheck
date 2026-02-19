import { createHmac, timingSafeEqual } from "node:crypto";

import type { PlanName } from "../config/plans";

export const ENTITLEMENT_SESSION_COOKIE_NAME = "rubricheck_entitlement";
export const ENTITLEMENT_SESSION_TTL_SECONDS = 60 * 60 * 12;

type EntitlementSessionPayload = {
  email: string;
  plan: "pro";
  exp: number;
};

function getSessionSecret(): string {
  const secret =
    process.env.ENTITLEMENT_SESSION_SECRET?.trim() ?? process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error("ENTITLEMENT_SESSION_SECRET_MISSING");
  }

  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const entries = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const cookies: Record<string, string> = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const rawValue = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    cookies[key] = rawValue;
  }

  return cookies;
}

export function createEntitlementSessionToken(params: { email: string; plan: "pro" }): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: EntitlementSessionPayload = {
    email: normalizeEmail(params.email),
    plan: params.plan,
    exp: nowSeconds + ENTITLEMENT_SESSION_TTL_SECONDS,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, getSessionSecret());
  return `${encodedPayload}.${signature}`;
}

export function verifyEntitlementSessionToken(token: string): EntitlementSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, getSessionSecret());
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const payloadJson = decodeBase64Url(encodedPayload);
  if (!payloadJson) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson) as {
      email?: unknown;
      plan?: unknown;
      exp?: unknown;
    };

    if (typeof payload.email !== "string" || !payload.email.trim()) {
      return null;
    }

    if (payload.plan !== "pro") {
      return null;
    }

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSeconds) {
      return null;
    }

    return {
      email: normalizeEmail(payload.email),
      plan: "pro",
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getPlanFromEntitlementCookie(request: Request): PlanName | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const token = cookies[ENTITLEMENT_SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  try {
    const payload = verifyEntitlementSessionToken(token);
    return payload?.plan ?? null;
  } catch {
    return null;
  }
}
