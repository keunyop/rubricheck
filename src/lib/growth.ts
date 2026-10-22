// Shared, closed vocabulary. Never send user input, email, full URLs or Stripe IDs.
export const GROWTH_CLIENT_EVENTS = ["page_view", "pricing_viewed", "evaluation_result_viewed", "evaluation_network_failed"] as const;
export type GrowthClientEvent = (typeof GROWTH_CLIENT_EVENTS)[number];
export type GrowthProduct = "unknown" | "guest" | "free" | "credits" | "pro" | "pro_monthly" | "pro_annual" | "pro_lifetime";
export type GrowthTouch = { source: string; medium: string; campaign: string; landing: string; referrer: string };
export const GROWTH_RETENTION_DAYS = 90;
export const PUBLIC_PATHS = ["/", "/pricing", "/rubric-checker", "/ai-rubric-grader", "/assignment-rubric-checker", "/essay-rubric-checker", "/rubric-feedback-tool", "/how-to-use-a-rubric-to-check-an-assignment"];
const SOURCES = ["google", "bing", "duckduckgo", "yahoo", "reddit", "facebook", "instagram", "youtube", "tiktok", "linkedin", "newsletter", "university"];
const MEDIUMS = ["organic", "cpc", "paid_social", "social", "email", "referral"];
// Add reviewed campaign identifiers here; arbitrary query strings can contain PII.
const CAMPAIGNS = ["rubric-checker", "essay-feedback", "assignment-feedback", "malaysia-students"];
const REFERRERS: Record<string, string> = { "google.com": "google", "google.com.my": "google", "google.co.kr": "google", "google.ca": "google", "bing.com": "bing", "duckduckgo.com": "duckduckgo", "search.yahoo.com": "yahoo", "reddit.com": "reddit", "facebook.com": "facebook", "instagram.com": "instagram", "youtube.com": "youtube", "tiktok.com": "tiktok", "linkedin.com": "linkedin" };
export function publicGrowthPath(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const path = value.split(/[?#]/)[0].replace(/^\/(ko|ms)(?=\/|$)/, "") || "/";
  return PUBLIC_PATHS.includes(path) ? path : "unknown";
}
const pick = (value: unknown, allowed: string[], fallback = "unknown") => typeof value === "string" && allowed.includes(value.toLowerCase()) ? value.toLowerCase() : fallback;
export function sanitizeTouch(value: unknown): GrowthTouch {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { source: pick(v.source, [...SOURCES, "direct", "other"]), medium: pick(v.medium, [...MEDIUMS, "none"]), campaign: pick(v.campaign, CAMPAIGNS), landing: publicGrowthPath(v.landing), referrer: pick(v.referrer, Object.keys(REFERRERS).concat("none", "other")) };
}
export function acquisitionTouch(url: string, referrer: string): GrowthTouch {
  let location: URL;
  try { location = new URL(url); } catch { return sanitizeTouch(null); }
  let domain = "none";
  try { const ref = new URL(referrer); if (ref.hostname !== location.hostname) domain = ref.hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  const recognizedDomain = Object.keys(REFERRERS).find(d => domain === d || domain.endsWith("." + d));
  const source = location.searchParams.has("utm_source") ? pick(location.searchParams.get("utm_source"), SOURCES) : recognizedDomain ? REFERRERS[recognizedDomain] : domain === "none" ? "direct" : "other";
  const medium = location.searchParams.has("utm_medium") ? pick(location.searchParams.get("utm_medium"), MEDIUMS) : ["google", "bing", "duckduckgo", "yahoo"].includes(source) ? "organic" : domain === "none" ? "none" : "referral";
  return sanitizeTouch({ source, medium, campaign: location.searchParams.get("utm_campaign"), landing: location.pathname, referrer: recognizedDomain ?? (domain === "none" ? "none" : "other") });
}
export function validGrowthId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function growthFailureCategory(status: number): string { return status >= 500 ? "server" : status === 401 || status === 403 || status === 429 ? "access" : "validation"; }
export function sameGrowthOrigin(request: Request): boolean {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    // Next may expose an internal URL after a rewrite; Host is the browser-facing host.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    return origin.host === host && (origin.protocol === "https:" || (["localhost", "127.0.0.1"].includes(origin.hostname) && origin.protocol === "http:"));
  } catch { return false; }
}
