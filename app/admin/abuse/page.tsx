import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAdminEmailFromSessionTokens } from "../../../src/lib/adminAuth";
import { CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession";
import { ENTITLEMENT_SESSION_COOKIE_NAME } from "../../../src/lib/entitlementSession";
import { buildNoIndexMetadata } from "../../../src/lib/seo";
import { AbuseAdminClient } from "./AbuseAdminClient";

export const metadata: Metadata = buildNoIndexMetadata(
  "Abuse Dashboard",
  "Private abuse monitoring dashboard for RubriCheck staff.",
);

function hasValidAdminSecret(adminSecretCookie: string | null): boolean {
  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) {
    return false;
  }

  return adminSecretCookie?.trim() === expectedSecret;
}

export default async function AbuseAdminPage() {
  const cookieStore = await cookies();
  const adminEmail = getAdminEmailFromSessionTokens({
    creditSessionToken: cookieStore.get(CREDIT_SESSION_COOKIE_NAME)?.value ?? null,
    entitlementSessionToken: cookieStore.get(ENTITLEMENT_SESSION_COOKIE_NAME)?.value ?? null,
  });

  const isAuthorized = Boolean(
    adminEmail ||
      hasValidAdminSecret(cookieStore.get("admin_secret")?.value ?? null),
  );
  if (!isAuthorized) {
    redirect("/pricing");
  }

  return <AbuseAdminClient />;
}
