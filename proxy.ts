import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CANONICAL_HOST } from "./src/lib/seo";
import { localeFromPath, stripLocale } from "./src/i18n/config";

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


  const forwardedProto = request.headers.get("x-forwarded-proto");
  const needsHttpsRedirect = forwardedProto === "http";
  const needsHostRedirect = normalizedHost !== CANONICAL_HOST;

  if (isCanonicalDomainRequest(normalizedHost) && (needsHttpsRedirect || needsHostRedirect)) {
    const url = request.nextUrl.clone(); url.protocol = "https"; url.hostname = CANONICAL_HOST; url.port = "";
    return NextResponse.redirect(url, 301);
  }
  const locale = localeFromPath(request.nextUrl.pathname);
  const pathname = stripLocale(request.nextUrl.pathname);
  const privatePath = /^\/(api|admin|billing|_next)(\/|$)/.test(pathname);
  const headers = new Headers(request.headers);
  headers.set("x-rubricheck-locale", privatePath ? "en" : locale);
  if (/^\/en(\/|$)/.test(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone(); url.pathname = pathname; url.host = request.headers.get("host") ?? url.host;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
