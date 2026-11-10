import { analyticsAllowed } from "./growthClient";
import { publicGrowthPath } from "./growth";
import type { GoogleTag } from "./googleTag";

export const QUIZ_ANALYTICS_EVENTS = ["quiz_discovery_viewed", "quiz_mode_selected", "quiz_sample_answered", "quiz_create_clicked"] as const;
export type QuizAnalyticsEvent = typeof QUIZ_ANALYTICS_EVENTS[number];
export type QuizPlacement = "tab" | "hero" | "sample";

// Only the public discovery funnel is sent to GA4. Private quiz routes, content,
// identifiers, answers and query strings never become event parameters.
export function quizAnalyticsPayload(url: string, placement: QuizPlacement) {
  if (!["tab", "hero", "sample"].includes(placement)) return null;
  let location: URL;
  try { location = new URL(url); } catch { return null; }
  const path = publicGrowthPath(location.pathname);
  const surface = path === "/" ? "home" : path === "/product" ? "product" : path === "/ai-quiz-generator" ? "overview" : null;
  if (!surface) return null;
  return { quiz_surface: surface, quiz_placement: placement, page_location: location.origin + location.pathname, page_referrer: "", page_title: "RubriCheck" };
}

export function trackQuiz(event: QuizAnalyticsEvent, placement: QuizPlacement): boolean {
  if (process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS !== "true" || !analyticsAllowed() || !QUIZ_ANALYTICS_EVENTS.includes(event)) return false;
  const payload = quizAnalyticsPayload(window.location.href, placement);
  if (!payload) return false;
  const tag = (window as Window & { gtag?: GoogleTag }).gtag;
  if (!tag) return false;
  // Analytics must never prevent selecting an answer or following the CTA.
  try { tag("event", event, payload); return true; } catch { return false; }
}
