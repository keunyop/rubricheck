"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useLanguage } from "./LanguageProvider";
import { analyticsAllowed, trackGrowth } from "../../src/lib/growthClient";
import { publicGrowthPath } from "../../src/lib/growth";
import { createGoogleTagQueue } from "../../src/lib/googleTag";

export function GrowthAnalytics() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [decided, setDecided] = useState(false);
  useEffect(() => { setAllowed(analyticsAllowed()); setDecided(document.cookie.includes("rubricheck_analytics=")); }, []);
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
  async function choose(granted: boolean) {
    if (!granted) await fetch("/api/analytics", {method:"DELETE",signal:AbortSignal.timeout(2000)}).catch(()=>{});
    document.cookie = `rubricheck_analytics=${granted ? "granted" : "denied"}; Path=/; SameSite=Lax; Max-Age=7776000${location.protocol === "https:" ? "; Secure" : ""}`;
    // Reload unloads already-loaded vendor scripts when consent is withdrawn.
    location.reload();
  }
  return <>
    <div className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-600">
      <span>{t(decided ? "Optional usage analytics" : "Allow optional usage analytics to help improve RubriCheck? Assignment content is never included.")}</span>{" "}
      <button type="button" className="ml-2 underline" onClick={() => choose(!allowed)}>{t(allowed ? "Turn off analytics" : "Allow analytics")}</button>
      {!decided && <button type="button" className="ml-4 underline" onClick={() => choose(false)}>{t("No thanks")}</button>}
    </div>
    {allowed && publicGrowthPath(pathname) !== "unknown" && <>
      <Analytics beforeSend={event => analyticsAllowed() && publicGrowthPath(new URL(event.url).pathname) !== "unknown" ? { ...event, url: new URL(event.url).origin + new URL(event.url).pathname } : null} />
      <SpeedInsights beforeSend={event => analyticsAllowed() && publicGrowthPath(new URL(event.url).pathname) !== "unknown" ? { ...event, url: new URL(event.url).origin + new URL(event.url).pathname } : null} />
    </>}
  </>;
}
