import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { growthEnabled, growthHash } from "./growthServer";
import { callSupabaseRpc } from "./supabaseRest";
import type { GrowthProduct } from "./growth";

// Analytics failures must return control to the existing billing handler promptly.
const stripeGrowthOptions: Stripe.RequestOptions = { timeout: 2500, maxNetworkRetries: 0 };

export function paymentProduct(metadata: Record<string, string> | null | undefined): GrowthProduct {
  if (metadata?.purchase_type === "credits") return "credits";
  if (["monthly", "annual", "lifetime"].includes(metadata?.pro_plan ?? "")) return `pro_${metadata!.pro_plan}` as GrowthProduct;
  return "unknown";
}
export function validAccountKey(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
export function invoicePaymentKind(reason: string | null) {
  return reason === "subscription_create" ? "subscription_initial" : reason === "subscription_cycle" ? "subscription_renewal" : "subscription_change";
}
export async function recordStripeGrowth(event: Stripe.Event, stripe: Stripe) {
  if (!growthEnabled()) return;
  // Never mix Stripe test traffic with production. Local tests exercise pure logic.
  if (!event.livemode) return;
  async function account(metadata: Record<string, string> | null | undefined, customer: string | { id: string } | null, email?: string | null) {
    if (validAccountKey(metadata?.growth_account)) return metadata!.growth_account;
    if (!email && customer) {
      const c = await stripe.customers.retrieve(typeof customer === "string" ? customer : customer.id, stripeGrowthOptions);
      if (!c.deleted) email = c.email;
    }
    return email ? growthHash("account:" + email.trim().toLowerCase()) : null;
  }
  async function save(key: string, accountKey: string | null, at: number, product: GrowthProduct, kind: string, amount: number, currency: string | null) {
    if (!currency || !/^[a-z]{3}$/.test(currency)) return;
    await callSupabaseRpc("rubricheck_growth_payment", { p_key: createHash("sha256").update("rubricheck:payment:" + key).digest("hex"), p_account: accountKey, p_at: new Date(at * 1000).toISOString(), p_product: product, p_kind: kind, p_amount: amount, p_currency: currency }, { timeoutMs: 2500 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Recurring first payments are recorded only from invoices, never checkout too.
    if (session.mode !== "payment" || session.payment_status !== "paid" || !session.payment_intent || !session.amount_total) return;
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    await save(`intent:${intent}`, await account(session.metadata, session.customer, session.customer_details?.email ?? session.customer_email), event.created, paymentProduct(session.metadata), "one_time", session.amount_total, session.currency);
  } else if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subRef = invoice.parent?.subscription_details?.subscription;
    if (!subRef || invoice.status !== "paid" || invoice.amount_paid <= 0) return;
    const sub = await stripe.subscriptions.retrieve(typeof subRef === "string" ? subRef : subRef.id, stripeGrowthOptions);
    const recurring = sub.items.data[0]?.price;
    const product = paymentProduct(sub.metadata);
    const inferred = product !== "unknown" ? product : recurring?.lookup_key === "pro_annual" ? "pro_annual" : recurring?.lookup_key === "pro_monthly" ? "pro_monthly" : "unknown";
    await save(`invoice:${invoice.id}`, await account(sub.metadata, invoice.customer, invoice.customer_email), invoice.status_transitions.paid_at ?? event.created, inferred, invoicePaymentKind(invoice.billing_reason), invoice.amount_paid, invoice.currency);
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await save(`canceled:${sub.id}`, await account(sub.metadata, sub.customer), sub.ended_at ?? event.created, paymentProduct(sub.metadata), "subscription_canceled", 0, sub.currency);
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const key = await account(charge.metadata, charge.customer);
    for await (const refund of stripe.refunds.list({ charge: charge.id, limit: 100 }, stripeGrowthOptions)) {
      if (refund.status === "succeeded") await save(`refund:${refund.id}`, key, refund.created, paymentProduct(charge.metadata), "refund", -refund.amount, refund.currency);
    }
  }
}
