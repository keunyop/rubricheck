import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CANONICAL_HOST } from "./src/lib/seo";

function isCanonicalDomainRequest(host: string): boolean {
  return host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`;
}

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  const normalizedHost = forwardedHost.split(":")[0].toLowerCase();

  if (!isCanonicalDomainRequest(normalizedHost)) {
    return NextResponse.next();
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const needsHttpsRedirect = forwardedProto === "http";
  const needsHostRedirect = normalizedHost !== CANONICAL_HOST;

  if (!needsHttpsRedirect && !needsHostRedirect) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = "https";
  redirectUrl.host = CANONICAL_HOST;

  return NextResponse.redirect(redirectUrl, 301);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
