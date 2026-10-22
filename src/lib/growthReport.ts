import type { GrowthTouch } from "./growth";

export type GrowthEventRow = {
  event_key: string; event_name: string; occurred_at: string; actor: string;
  account_key: string | null; visitor_id: string | null; journey: string; product: string;
  attempt_id: string | null; evaluation_id: string | null; failure: string | null;
  first_touch: GrowthTouch | null; last_touch: GrowthTouch | null; country: string;
  prior_payer: boolean | null;
};
export type GrowthPaymentRow = {
  payment_key: string; account_key: string | null; occurred_at: string; product: string; kind: string;
  amount_minor: number; currency: string; prior_payer: boolean | null; first_paid_at: string | null;
  first_touch: GrowthTouch | null; last_touch: GrowthTouch | null; country: string;
};
export type GrowthSnapshot = { events: GrowthEventRow[]; payments: GrowthPaymentRow[]; collectionStartedAt: string | null; generatedAt: string };
const DAY = 86400000;
const STEPS = [
  ["Visitor → evaluation started", "page_view", "evaluation_started"],
  ["Evaluation started → result viewed", "evaluation_started", "evaluation_result_viewed"],
  ["Guest preview → signup", "guest_preview_completed", "signup_completed"],
  ["Signup → first meaningful evaluation", "signup_completed", "evaluation_completed"],
  ["Free evaluation → checkout", "evaluation_completed", "checkout_started"],
  ["Checkout → first successful purchase", "checkout_started", "purchase_completed"],
] as const;
export function summarizeGrowth(data: GrowthSnapshot, from: string, to: string) {
  const start = Date.parse(from), end = Date.parse(to), cutoff = end - 7 * DAY;
  const complete = data.events.length <= 50000 && data.payments.length <= 50000;
  const events = [...data.events].sort((a,b) => Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  const payments = data.payments.filter(p => p.amount_minor > 0 && !["refund", "subscription_canceled"].includes(p.kind));
  const byActor = new Map<string, GrowthEventRow[]>();
  for (const e of events) { if (!e.actor) continue; const list = byActor.get(e.actor) ?? []; list.push(e); byActor.set(e.actor, list); }
  const firstPurchase = (p: GrowthPaymentRow) => p.prior_payer === false && p.first_paid_at !== null && Date.parse(p.first_paid_at) === Date.parse(p.occurred_at);
  const funnel = STEPS.flatMap(([label, entry, destination]) => {
    const cohorts = new Map<string, GrowthEventRow>();
    for (const e of events) if (e.actor && e.event_name === entry && (label !== "Free evaluation → checkout" || e.product === "free") && Date.parse(e.occurred_at) >= start && Date.parse(e.occurred_at) < end && !cohorts.has(e.actor)) cohorts.set(e.actor,e);
    const groups = new Map<string, { journey: string; source: string; country: string; eligible: number; converted: number; pending: number; failed: number; excluded: number }>();
    for (const [actor, first] of cohorts) {
      const source = first.first_touch?.source ?? "unknown";
      const key = [first.journey,source,first.country].join("|");
      const g = groups.get(key) ?? { journey: first.journey, source, country: first.country, eligible: 0, converted: 0, pending: 0, failed: 0, excluded: 0 };
      groups.set(key,g);
      const at = Date.parse(first.occurred_at);
      if (destination === "purchase_completed" && first.prior_payer !== false) { g.excluded++; continue; }
      if (at > cutoff) { g.pending++; continue; }
      g.eligible++;
      const inWindow = (date: string) => Date.parse(date) >= at && Date.parse(date) < at + 7 * DAY;
      if (destination === "purchase_completed") {
        if (payments.some(p => p.account_key === actor && firstPurchase(p) && inWindow(p.occurred_at))) g.converted++;
      } else {
        if ((byActor.get(actor) ?? []).some(e => e.event_name === destination && inWindow(e.occurred_at) && (entry !== "evaluation_started" || (Boolean(first.attempt_id) && e.attempt_id === first.attempt_id)))) g.converted++;
      }
      if (entry === "evaluation_started" && (byActor.get(actor) ?? []).some(e => e.event_name === "evaluation_failed" && e.attempt_id === first.attempt_id && inWindow(e.occurred_at))) g.failed++;
    }
    if (!groups.size) groups.set("empty", {journey:"all",source:"unknown",country:"unknown",eligible:0,converted:0,pending:0,failed:0,excluded:0});
    return [...groups.values()].map(g => ({ step: label, ...g, rate: complete && g.eligible > 0 ? g.converted / g.eligible : null }));
  });
  const acquisition = new Map<string, { source: string; lastSource: string; country: string; currency: string; firstPayingCustomers: number; revenueMinor: number; refundsMinor: number; renewalMinor: number; lifetimeMinor: number }>();
  const seenFirst = new Set<string>();
  for (const p of data.payments) {
    if (p.kind === "subscription_canceled") continue;
    const source = p.first_touch?.source ?? "unknown", lastSource = p.last_touch?.source ?? "unknown";
    const key = [source,lastSource,p.country,p.currency].join("|");
    const row = acquisition.get(key) ?? { source,lastSource,country:p.country,currency:p.currency,firstPayingCustomers:0,revenueMinor:0,refundsMinor:0,renewalMinor:0,lifetimeMinor:0 };
    if (p.amount_minor > 0) row.revenueMinor += p.amount_minor;
    if (p.kind === "refund") row.refundsMinor += -p.amount_minor;
    if (p.kind === "subscription_renewal") row.renewalMinor += p.amount_minor;
    if (p.product === "pro_lifetime" && p.amount_minor > 0) row.lifetimeMinor += p.amount_minor;
    if (p.account_key && firstPurchase(p) && !seenFirst.has(p.account_key)) { row.firstPayingCustomers++; seenFirst.add(p.account_key); }
    acquisition.set(key,row);
  }
  return {
    from,to,observationDays:7,complete,collectionStartedAt:data.collectionStartedAt,generatedAt:data.generatedAt,
    coverage:"Opted-in, observable journeys only. Signup is first verified account without a prior usage/billing footprint. A non-conversion is not proof of voluntary abandonment.",
    funnel,acquisition:[...acquisition.values()].sort((a,b)=>b.firstPayingCustomers-a.firstPayingCustomers),
    paymentEvents:data.payments.length,firstPurchaseUnknown:payments.filter(p=>p.prior_payer===null || !p.account_key).length,
    subscriptionStarts:payments.filter(p=>p.kind==="subscription_initial").length,
    subscriptionCancellations:data.payments.filter(p=>p.kind==="subscription_canceled").length,
    failures:Object.fromEntries(["server","validation","access","network"].map(kind=>[kind,events.filter(e=>e.failure===kind).length])),
  };
}
export type GrowthReport = ReturnType<typeof summarizeGrowth>;
