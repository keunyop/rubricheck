"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsAllowed, trackGrowth } from "../../src/lib/growthClient";
import { publicGrowthPath } from "../../src/lib/growth";
import { createGoogleTagQueue } from "../../src/lib/googleTag";

export function GrowthAnalytics() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    // Start automatically after hydration, respecting saved opt-outs and DNT/GPC.
    setAllowed(analyticsAllowed());
  }, []);
  useEffect(() => {
    if (!allowed || publicGrowthPath(pathname) === "unknown") return;
    trackGrowth("page_view");
    if (publicGrowthPath(pathname) === "/pricing") trackGrowth("pricing_viewed");
    // Enable only after Enhanced Measurement (history/forms/outbound links) is
    // disabled in the existing GA4 property. Otherwise GA can bypass URL redaction.
    if (process.env.NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS !== "true") return;
    // Keep GA4 page views, with clean URLs and no user IDs or payment parameters.
    const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    w.dataLayer ??= [];
    w.gtag ??= createGoogleTagQueue(entry => { w.dataLayer!.push(entry); });
    if (!document.getElementById("rubricheck-ga4")) {
      const script = document.createElement("script"); script.id = "rubricheck-ga4"; script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=G-S7M12R54DP"; document.head.appendChild(script);
      w.gtag("js", new Date());
      w.gtag("config", "G-S7M12R54DP", { send_page_view: false, page_location: location.origin + pathname, page_referrer: "", page_title: "RubriCheck", allow_google_signals: false, allow_ad_personalization_signals: false });
    }
    w.gtag("event", "page_view", { page_location: location.origin + pathname, page_referrer: "", page_title: "RubriCheck" });
  }, [allowed, pathname]);
  return <>
    {allowed && publicGrowthPath(pathname) !== "unknown" && <>
      <Analytics beforeSend={event => analyticsAllowed() && publicGrowthPath(new URL(event.url).pathname) !== "unknown" ? { ...event, url: new URL(event.url).origin + new URL(event.url).pathname } : null} />
      <SpeedInsights beforeSend={event => analyticsAllowed() && publicGrowthPath(new URL(event.url).pathname) !== "unknown" ? { ...event, url: new URL(event.url).origin + new URL(event.url).pathname } : null} />
    </>}
  </>;
}
