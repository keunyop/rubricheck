import { getCreditEmailFromCookie, verifyCreditSessionToken } from "./creditSession";
import { getEntitlementEmailFromCookie, verifyEntitlementSessionToken } from "./entitlementSession";
import { getPublicAdminEmails, normalizeAdminEmail } from "../config/admin";

function getConfiguredAdminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => normalizeAdminEmail(entry))
    .filter((entry) => entry.length > 0);

  return Array.from(new Set([...getPublicAdminEmails(), ...fromEnv]));
}

export function getAdminSecretFromRequest(request: Request): string {
  const headerSecret = request.headers.get("x-admin-secret")?.trim();
  if (headerSecret) return headerSecret;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookiePart = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("admin_secret="));

  if (!cookiePart) return "";
  return decodeURIComponent(cookiePart.slice("admin_secret=".length));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return getConfiguredAdminEmails().includes(normalizeAdminEmail(email));
}

export function getAdminEmailFromSessionTokens(params: {
  creditSessionToken?: string | null;
  entitlementSessionToken?: string | null;
}): string | null {
  try {
    const creditEmail = params.creditSessionToken ? verifyCreditSessionToken(params.creditSessionToken)?.email ?? null : null;
    if (isAdminEmail(creditEmail)) {
      return normalizeAdminEmail(creditEmail as string);
    }
  } catch {
    // Ignore invalid session tokens.
  }

  try {
    const entitlementEmail = params.entitlementSessionToken
      ? verifyEntitlementSessionToken(params.entitlementSessionToken)?.email ?? null
      : null;
    if (isAdminEmail(entitlementEmail)) {
      return normalizeAdminEmail(entitlementEmail as string);
    }
  } catch {
    // Ignore invalid session tokens.
  }

  return null;
}

export function getAdminEmailFromRequest(request: Request): string | null {
  const creditEmail = getCreditEmailFromCookie(request);
  if (isAdminEmail(creditEmail)) {
    return normalizeAdminEmail(creditEmail as string);
  }

  const entitlementEmail = getEntitlementEmailFromCookie(request);
  if (isAdminEmail(entitlementEmail)) {
    return normalizeAdminEmail(entitlementEmail as string);
  }

  return null;
}

export function isAdminAuthorized(request: Request): boolean {
  if (getAdminEmailFromRequest(request)) {
    return true;
  }

  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) return false;
  return getAdminSecretFromRequest(request) === expectedSecret;
}
