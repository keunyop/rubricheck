import { stripLocale } from "../i18n/config";
import { BLOG_INDEX, BLOG_POSTS } from "../config/blog";

// Shared, closed vocabulary. Never send user input, email, full URLs or Stripe IDs.
export const GROWTH_CLIENT_EVENTS = ["page_view", "pricing_viewed", "evaluation_result_viewed", "evaluation_network_failed"] as const;
export type GrowthClientEvent = (typeof GROWTH_CLIENT_EVENTS)[number];
export type GrowthProduct = "unknown" | "guest" | "free" | "credits" | "pro" | "pro_monthly" | "pro_annual" | "pro_lifetime";
export type GrowthTouch = { source: string; medium: string; campaign: string; landing: string; referrer: string };
export const GROWTH_RETENTION_DAYS = 90;
export const PUBLIC_PATHS = ["/", "/workspace", "/product", "/help", "/pricing", "/rubric-checker", "/ai-rubric-grader", "/assignment-rubric-checker", "/essay-rubric-checker", "/rubric-feedback-tool", "/how-to-use-a-rubric-to-check-an-assignment", "/ai-quiz-generator"];
const SOURCES = ["google", "bing", "duckduckgo", "yahoo", "reddit", "facebook", "instagram", "youtube", "tiktok", "linkedin", "newsletter", "university"];
const MEDIUMS = ["organic", "cpc", "paid_social", "social", "email", "referral"];
// Add reviewed campaign identifiers here; arbitrary query strings can contain PII.
const CAMPAIGNS = ["rubric-checker", "essay-feedback", "assignment-feedback", "malaysia-students"];
const REFERRERS: Record<string, string> = { "google.com": "google", "google.com.my": "google", "google.co.kr": "google", "google.ca": "google", "bing.com": "bing", "duckduckgo.com": "duckduckgo", "search.yahoo.com": "yahoo", "reddit.com": "reddit", "facebook.com": "facebook", "instagram.com": "instagram", "youtube.com": "youtube", "tiktok.com": "tiktok", "linkedin.com": "linkedin" };
export function publicGrowthPath(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const path = stripLocale(value.split(/[?#]/)[0]) || "/";
  return PUBLIC_PATHS.includes(path) || [BLOG_INDEX.path, ...BLOG_POSTS.map(post => post.path)].includes(path) ? path : "unknown";
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
// Only fixed, server-owned categories enter first-party analytics. Error messages,
// uploaded names/text and unrecognized response codes are never stored.
const INPUT_FAILURE_CODES = ["INVALID_JSON", "INVALID_INPUT", "INVALID_MODE", "INVALID_FORM_DATA", "MISSING_INPUT", "TRIAL_INPUT_TOO_LONG"];
export function growthInputFailureCode(status: number, code: unknown): string | null {
  return status >= 400 && status < 500 && ![401, 403, 429].includes(status) && typeof code === "string" && INPUT_FAILURE_CODES.includes(code) ? code : null;
}
export function growthFailureCategory(status: number, code?: unknown): string {
  if (status >= 500) return "server";
  if (status === 401 || status === 403 || status === 429) return "access";
  const safeCode = typeof code === "string" ? code : "";
  if (safeCode === "TRIAL_PENDING" || safeCode === "EVALUATION_PENDING" || safeCode === "EVALUATION_ALREADY_COMPLETED") return "validation_pending";
  if (["FILE_TOO_LARGE", "FILE_TOTAL_TOO_LARGE", "MULTI_FILE_IMAGES_ONLY", "UNSUPPORTED_FILE_TYPE", "FILE_PARSE_FAILED", "TEXT_EXTRACTION_FAILED", "PROTECTED_FILE", "IMAGE_TOO_SMALL", "EXTERNAL_DOCX_IMAGE"].includes(safeCode)) return "validation_file";
  if (safeCode === "RUBRIC_CRITERIA_NOT_FOUND" || safeCode === "RUBRIC_STRUCTURE_FAILED") return "validation_rubric";
  if (INPUT_FAILURE_CODES.includes(safeCode)) return "validation_input";
  return "validation_other";
}
export function sameGrowthOrigin(request: Request): boolean {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    // Next may expose an internal URL after a rewrite; Host is the browser-facing host.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    return origin.host === host && (origin.protocol === "https:" || (["localhost", "127.0.0.1"].includes(origin.hostname) && origin.protocol === "http:"));
  } catch { return false; }
}
