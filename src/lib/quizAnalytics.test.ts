import assert from "node:assert/strict";
import test from "node:test";
import { LOCALES, localizedPath } from "../i18n/config.ts";
import { quizAnalyticsPayload, trackQuiz } from "./quizAnalytics.ts";

test("quiz discovery events retain only public localized paths and closed dimensions", () => {
  for (const locale of LOCALES) {
    for (const [path, surface] of [["/", "home"], ["/product", "product"], ["/ai-quiz-generator", "overview"]]) {
      const clean = "https://rubricheck.com" + localizedPath(path, locale);
      assert.deepEqual(quizAnalyticsPayload(clean + "?email=private&quiz=secret#source", "sample"), {
        quiz_surface: surface, quiz_placement: "sample", page_location: clean, page_referrer: "", page_title: "RubriCheck",
      });
    }
    for (const path of ["/quizzes?view=create&assignment=secret", "/workspace", "/pricing", "/billing/manage", "/admin", "/api/quizzes"]) {
      assert.equal(quizAnalyticsPayload("https://rubricheck.com" + localizedPath(path, locale), "hero"), null);
    }
  }
  assert.equal(quizAnalyticsPayload("invalid", "hero"), null);
  assert.equal(quizAnalyticsPayload("https://rubricheck.com/", "private-source" as "hero"), null);
});

test("quiz events honor analytics gates and never send private routes, payloads or arbitrary event names", () => {
  const previous = ["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const priorFlag = process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS;
  const events: unknown[][] = [];
  const browser = { location: { href: "https://rubricheck.com/ko?email=secret#source" }, gtag: (...args: unknown[]) => events.push(args) };
  const doc = { cookie: "" };
  const nav = { doNotTrack: "0", globalPrivacyControl: false };
  try {
    const globals: Array<[string, unknown]> = [["window", browser], ["document", doc], ["navigator", nav]];
    for (const [key, value] of globals) Object.defineProperty(globalThis, key, { configurable: true, value });
    process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS = "true";
    trackQuiz("quiz_create_clicked", "sample");
    assert.deepEqual(events, [["event", "quiz_create_clicked", { quiz_surface: "home", quiz_placement: "sample", page_location: "https://rubricheck.com/ko", page_referrer: "", page_title: "RubriCheck" }]]);
    doc.cookie = "rubricheck_analytics=denied"; trackQuiz("quiz_create_clicked", "sample"); doc.cookie = "";
    nav.doNotTrack = "1"; trackQuiz("quiz_create_clicked", "sample"); nav.doNotTrack = "0";
    nav.globalPrivacyControl = true; trackQuiz("quiz_create_clicked", "sample"); nav.globalPrivacyControl = false;
    process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS = "false"; trackQuiz("quiz_create_clicked", "sample");
    process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS = "true";
    browser.location.href = "https://rubricheck.com/quizzes?view=create&assignment=secret"; trackQuiz("quiz_create_clicked", "sample");
    browser.location.href = "https://rubricheck.com/"; trackQuiz("secret-source" as "quiz_create_clicked", "sample");
    assert.equal(events.length, 1);
    assert.equal(JSON.stringify(events).includes("secret"), false);
    browser.gtag = () => { throw new Error("analytics unavailable"); };
    assert.doesNotThrow(() => trackQuiz("quiz_create_clicked", "sample"));
  } finally {
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    if (priorFlag === undefined) delete process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS; else process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS = priorFlag;
  }
});
