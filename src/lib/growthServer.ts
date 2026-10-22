import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCreditEmailFromCookie } from "./creditSession";
import { callSupabaseRpc, hasSupabaseConfig, type JsonRecord } from "./supabaseRest";
import { growthFailureCategory, sanitizeTouch, validGrowthId, type GrowthProduct, type GrowthTouch } from "./growth";

export const GROWTH_COOKIE = "rubricheck_growth";
export const CONSENT_COOKIE = "rubricheck_analytics";
const TTL = 90 * 86400;
export function growthRpc<T>(name: string, params: JsonRecord): Promise<T> { return callSupabaseRpc<T>(name, params, { timeoutMs: 1200 }); }
export function growthEnabled(): boolean { return process.env.GROWTH_ANALYTICS_ENABLED === "true" && Boolean(process.env.GROWTH_HASH_SECRET?.trim()) && hasSupabaseConfig(); }
export function growthHash(value: string): string { const key = process.env.GROWTH_HASH_SECRET?.trim(); if (!key) throw Error("GROWTH_NOT_CONFIGURED"); return createHmac("sha256", key).update(value).digest("hex"); }
function cookie(request: Request, name: string): string { return (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).find(v => v.startsWith(name + "="))?.slice(name.length + 1) ?? ""; }
export function growthConsent(request: Request): boolean { return cookie(request, CONSENT_COOKIE) === "granted" && request.headers.get("dnt") !== "1" && request.headers.get("sec-gpc") !== "1"; }
export function visitorCookie(id: string, now = Date.now()): string { const body = `${id}.${Math.floor(now / 1000) + TTL}`; return `${body}.${growthHash("visitor:" + body)}`; }
export function growthVisitor(request: Request): string | null {
  if (!growthEnabled() || !growthConsent(request)) return null;
  const [id, exp, signature] = cookie(request, GROWTH_COOKIE).split(".");
  if (!validGrowthId(id) || !/^\d+$/.test(exp ?? "") || Number(exp) <= Date.now() / 1000 || !/^[a-f0-9]{64}$/.test(signature ?? "")) return null;
  const expected = growthHash(`visitor:${id}.${exp}`);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}
export function setGrowthVisitor(response: NextResponse, id: string) { response.cookies.set(GROWTH_COOKIE, visitorCookie(id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL }); }
export function growthCountry(request: Request): string { const country = request.headers.get("x-vercel-ip-country") ?? ""; return process.env.VERCEL === "1" && /^[A-Z]{2}$/.test(country) ? country : "unknown"; }
export async function safeGrowth(work: () => Promise<unknown>): Promise<void> { if (!growthEnabled()) return; try { await work(); } catch { console.warn("GROWTH_WRITE_FAILED"); } }
export function growthAccount(request: Request): string | null { const email = getCreditEmailFromCookie(request); return email ? growthHash("account:" + email.trim().toLowerCase()) : null; }

export async function recordGrowthEvent(request: Request, event: {
  name: string; key: string; product?: GrowthProduct; attempt?: string | null; evaluation?: string | null; failure?: string | null; visitor?: string; touch?: GrowthTouch;
}) {
  if (!growthEnabled() || !growthConsent(request)) return;
  const visitor = event.visitor ?? growthVisitor(request);
  if (!visitor) return;
  await growthRpc("rubricheck_growth_event", {
    p_event_key: growthHash("event:" + event.key), p_event_name: event.name, p_visitor: visitor,
    p_account: growthAccount(request), p_product: event.product ?? "unknown",
    p_attempt: validGrowthId(event.attempt) ? event.attempt : null, p_evaluation: validGrowthId(event.evaluation) ? event.evaluation : null,
    p_failure: event.failure ?? null, p_touch: event.touch ? sanitizeTouch(event.touch) : null, p_country: growthCountry(request),
  });
}

// Called only after successful OTP verification. Signup means first verified account
// with no existing usage/billing footprint; previous unused logins cannot be recovered.
export async function recordGrowthLogin(request: Request, response: Response, email: string) {
  await safeGrowth(async () => {
    if (!growthConsent(request)) return;
    const account = growthHash("account:" + email.trim().toLowerCase());
    const visitor = growthVisitor(request);
    await growthRpc("rubricheck_growth_identify", { p_account: account, p_email: email, p_visitor: visitor, p_verified_login: true });
    // Rotate after identity linkage, avoiding guest merges across shared-device accounts.
    if (response instanceof NextResponse) setGrowthVisitor(response, randomUUID());
  });
}

export async function growthCheckoutMetadata(request: Request): Promise<Record<string, string>> {
  if (!growthEnabled()) return {};
  try {
    const email = getCreditEmailFromCookie(request);
    if (!email) return {};
    const account = growthHash("account:" + email.trim().toLowerCase());
    await growthRpc("rubricheck_growth_identify", { p_account: account, p_email: email, p_visitor: growthVisitor(request), p_verified_login: false });
    return { growth_account: account, ...(growthVisitor(request) ? { growth_visitor: growthVisitor(request)! } : {}) };
  } catch { console.warn("GROWTH_WRITE_FAILED"); return {}; }
}

export async function recordGrowthCheckout(request: Request, sessionId: string, product: GrowthProduct) {
  await safeGrowth(() => recordGrowthEvent(request, { name: "checkout_started", key: `checkout:${sessionId}`, product }));
}

export async function instrumentGrade(request: Request, run: (request: Request) => Promise<Response>): Promise<Response> {
  const attempt = randomUUID();
  const account = getCreditEmailFromCookie(request);
  await safeGrowth(() => recordGrowthEvent(request, { name: "evaluation_started", key: `start:${attempt}`, attempt, product: account ? "unknown" : "guest" }));
  let response: Response;
  try { response = await run(request); } catch (error) {
    await safeGrowth(() => recordGrowthEvent(request, { name: "evaluation_failed", key: `failed:${attempt}`, attempt, failure: "server" }));
    throw error;
  }
  response.headers.set("x-growth-attempt", attempt);
  await safeGrowth(async () => {
    // Only whitelisted scalar fields leave this scope. Never serialize the result.
    const data = response.ok ? await response.clone().json().catch(() => ({})) : {};
    const billingProduct = response.headers.get("x-growth-product");
    const product: GrowthProduct = data.guest_preview === true ? "guest" : billingProduct === "pro" || billingProduct === "credits" || billingProduct === "free" ? billingProduct : account ? "unknown" : "guest";
    await recordGrowthEvent(request, { name: response.ok ? product === "guest" ? "guest_preview_completed" : "evaluation_completed" : "evaluation_failed", key: `outcome:${attempt}`, attempt, product, evaluation: data.evaluation_id, failure: response.ok ? null : growthFailureCategory(response.status) });
  });
  return response;
}
