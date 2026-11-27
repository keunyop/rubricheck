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
  ["First valid result viewed → checkout", "evaluation_result_viewed", "checkout_started"],
  ["Checkout → first successful purchase", "checkout_started", "purchase_completed"],
] as const;

function validResultViews(events: GrowthEventRow[]) {
  const successTimes = new Map<string, number>();
  const keys = (event: GrowthEventRow) => [
    ...(event.attempt_id ? [JSON.stringify([event.actor, "attempt", event.attempt_id])] : []),
    ...(event.evaluation_id ? [JSON.stringify([event.actor, "evaluation", event.evaluation_id])] : []),
  ];
  for (const event of events) {
    if (!event.actor || !["evaluation_completed", "guest_preview_completed"].includes(event.event_name)) continue;
    const at = Date.parse(event.occurred_at);
    for (const key of keys(event)) {
      if (!successTimes.has(key)) successTimes.set(key, at);
    }
  }
  return new Set(events.filter(event =>
    event.event_name === "evaluation_result_viewed" &&
    keys(event).some(key => (successTimes.get(key) ?? Infinity) <= Date.parse(event.occurred_at))
  ));
}

const CHECKOUT_PRODUCTS = new Set(["credits", "pro_monthly", "pro_annual", "pro_lifetime"]);

function firstPaymentCohort(
  views: Set<GrowthEventRow>,
  byActor: Map<string, GrowthEventRow[]>,
  payments: GrowthPaymentRow[],
  start: number,
  end: number,
  complete: boolean,
) {
  const paymentsByAccount = new Map<string, GrowthPaymentRow[]>();
  for (const payment of payments) {
    if (!payment.account_key) continue;
    const rows = paymentsByAccount.get(payment.account_key) ?? [];
    rows.push(payment);
    paymentsByAccount.set(payment.account_key, rows);
  }
  const seen = new Set<string>();
  let eligible = 0, checkoutStarted = 0, pending = 0, unknownHistory = 0, priorPaid = 0;
  let firstPaymentUnmatched = 0;
  const paid = { subscription: 0, credit: 0, lifetime: 0 };
  for (const view of views) {
    const at = Date.parse(view.occurred_at);
    if (!view.actor || at < start || at >= end || seen.has(view.actor)) continue;
    seen.add(view.actor);
    const actorPayments = paymentsByAccount.get(view.actor) ?? [];
    if (view.prior_payer === true || actorPayments.some(payment =>
      Date.parse(payment.first_paid_at ?? payment.occurred_at) <= at
    )) {
      priorPaid++;
      continue;
    }
    if (view.prior_payer !== false) { unknownHistory++; continue; }
    const deadline = at + 7 * DAY;
    if (deadline > end) { pending++; continue; }
    eligible++;
    const checkoutTimes = new Map<string, number>();
    for (const event of byActor.get(view.actor) ?? []) {
      if (event.event_name !== "checkout_started" || !CHECKOUT_PRODUCTS.has(event.product)) continue;
      const startedAt = Date.parse(event.occurred_at);
      if (startedAt > at && startedAt < deadline && !checkoutTimes.has(event.product)) {
        checkoutTimes.set(event.product, startedAt);
      }
    }
    if (checkoutTimes.size > 0) checkoutStarted++;
    const firstPayments = actorPayments.filter(payment =>
      Date.parse(payment.occurred_at) > at && Date.parse(payment.occurred_at) < deadline
      && payment.prior_payer === false && payment.first_paid_at !== null
      && Date.parse(payment.first_paid_at) === Date.parse(payment.occurred_at)
    );
    if (firstPayments.length === 0) continue;
    const [payment] = firstPayments;
    const checkoutAt = checkoutTimes.get(payment.product);
    if (firstPayments.length !== 1 || checkoutAt === undefined || Date.parse(payment.occurred_at) <= checkoutAt) {
      firstPaymentUnmatched++;
      continue;
    }
    if (payment.kind === "subscription_initial" && ["pro_monthly", "pro_annual"].includes(payment.product)) paid.subscription++;
    else if (payment.kind === "one_time" && payment.product === "credits") paid.credit++;
    else if (payment.kind === "one_time" && payment.product === "pro_lifetime") paid.lifetime++;
    else firstPaymentUnmatched++;
  }
  const firstPaymentMatched = paid.subscription + paid.credit + paid.lifetime;
  return {
    eligible, checkoutStarted, firstPaymentMatched, firstPaymentUnmatched, paid, pending, unknownHistory, priorPaid,
    checkoutRate: complete && eligible > 0 ? checkoutStarted / eligible : null,
    firstPaymentRate: complete && eligible > 0 ? firstPaymentMatched / eligible : null,
  };
}

export function summarizeGrowth(data: GrowthSnapshot, from: string, to: string) {
  const start = Date.parse(from), end = Date.parse(to), cutoff = end - 7 * DAY;
  const complete = data.events.length <= 50000 && data.payments.length <= 50000;
  const events = [...data.events].sort((a,b) => Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  const linkedViews = validResultViews(events);
  const payments = data.payments.filter(p => p.amount_minor > 0 && !["refund", "subscription_canceled"].includes(p.kind));
  const byActor = new Map<string, GrowthEventRow[]>();
  for (const e of events) { if (!e.actor) continue; const list = byActor.get(e.actor) ?? []; list.push(e); byActor.set(e.actor, list); }
  const firstPurchase = (p: GrowthPaymentRow) => p.prior_payer === false && p.first_paid_at !== null && Date.parse(p.first_paid_at) === Date.parse(p.occurred_at);
  const revenueCohort = firstPaymentCohort(linkedViews, byActor, payments, start, Math.min(end, Date.parse(data.generatedAt)), complete);
  const funnel = STEPS.flatMap(([label, entry, destination]) => {
    const cohorts = new Map<string, GrowthEventRow>();
    for (const e of events) {
      if (!e.actor || e.event_name !== entry || cohorts.has(e.actor)) continue;
      const at = Date.parse(e.occurred_at);
      if (at < start || at >= end) continue;
      if (entry === "evaluation_result_viewed" && !linkedViews.has(e)) continue;
      cohorts.set(e.actor, e);
    }
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
    funnel,revenueCohort,acquisition:[...acquisition.values()].sort((a,b)=>b.firstPayingCustomers-a.firstPayingCustomers),
    paymentEvents:data.payments.length,firstPurchaseUnknown:payments.filter(p=>p.prior_payer===null || !p.account_key).length,
    subscriptionStarts:payments.filter(p=>p.kind==="subscription_initial").length,
    subscriptionCancellations:data.payments.filter(p=>p.kind==="subscription_canceled").length,
    failures:Object.fromEntries(["server","validation","access","network"].map(kind=>[kind,events.filter(e=>kind==="validation" ? e.failure==="validation" || e.failure?.startsWith("validation_") : e.failure===kind).length])),
    validationReasons:Object.fromEntries(["validation_input","validation_file","validation_rubric","validation_pending","validation_other"].map(kind=>[kind,events.filter(e=>e.failure===kind).length])),
  };
}
export type GrowthReport = ReturnType<typeof summarizeGrowth>;
