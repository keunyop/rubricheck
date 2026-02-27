import { createRequestContext, successJson } from "../../../../src/lib/apiError";
import { CREDIT_SESSION_COOKIE_NAME } from "../../../../src/lib/creditSession";
import { ENTITLEMENT_SESSION_COOKIE_NAME } from "../../../../src/lib/entitlementSession";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const response = successJson(context, { ok: true });

  response.cookies.set({
    name: ENTITLEMENT_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: CREDIT_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
