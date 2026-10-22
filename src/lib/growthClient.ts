import { acquisitionTouch, type GrowthClientEvent } from "./growth";

export function analyticsAllowed(): boolean {
  return typeof window !== "undefined" && navigator.doNotTrack !== "1" && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl && document.cookie.split(";").some(v => v.trim() === "rubricheck_analytics=granted");
}
let queue: Promise<unknown> = Promise.resolve();
let capturedEntry = false;
export function trackGrowth(name: GrowthClientEvent, fields: { attempt?: string; evaluation?: string } = {}): void {
  if (!analyticsAllowed() || !document.documentElement.dataset.growthEnabled) return;
  const touch = name === "page_view" && !capturedEntry ? acquisitionTouch(window.location.href, document.referrer) : undefined;
  if (name === "page_view") capturedEntry = true;
  queue = queue.catch(() => {}).then(async () => {
    if (!analyticsAllowed()) return;
    await fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, id: crypto.randomUUID(), touch, ...fields }), keepalive: true, signal: AbortSignal.timeout(1500) });
  }).catch(() => {});
}
export async function flushGrowth(): Promise<void> {
  // Attribution must never hold up evaluation when analytics/network is unavailable.
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 1500);
    void queue.finally(() => { clearTimeout(timer); resolve(); });
  });
}
