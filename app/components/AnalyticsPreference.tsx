"use client";

import { useSyncExternalStore } from "react";
import { analyticsAllowed } from "../../src/lib/growthClient";
import { useLanguage } from "./LanguageProvider";

const subscribe = () => () => {};
const serverSnapshot = () => null;

// Preferences change through a reload; read browser state after hydration.
export function AnalyticsPreference() {
  const { t } = useLanguage();
  const enabled = useSyncExternalStore<boolean | null>(subscribe, analyticsAllowed, serverSnapshot);

  async function changePreference() {
    if (enabled) await fetch("/api/analytics", { method: "DELETE", signal: AbortSignal.timeout(2000) }).catch(() => {});
    document.cookie = `rubricheck_analytics=${enabled ? "denied" : "granted"}; Path=/; SameSite=Lax; Max-Age=7776000${location.protocol === "https:" ? "; Secure" : ""}`;
    // Reload also unloads vendor scripts that were already running.
    location.reload();
  }

  return enabled === null ? null : <button type="button" className="mt-3 min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium underline" onClick={changePreference}>
    {t(enabled ? "Turn off analytics" : "Allow analytics")}
  </button>;
}
