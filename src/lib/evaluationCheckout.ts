import type Stripe from "stripe";
import { getEvaluation, normalizeEvaluationId, ownerHash, recoveryKey, recoveryRedis } from "./evaluationRecovery.ts";

export async function validateCheckoutEvaluation(value: unknown, email: string) {
  if (value === undefined || value === null || value === "") return null;
  const id = normalizeEvaluationId(value);
  const record = id ? await getEvaluation(id, email) : null;
  if (!id || !record) throw new Error("EVALUATION_EXPIRED");
  // Keep the original task through delayed payment confirmation, beyond the browser draft window.
  // Update only the expiry atomically, so a simultaneous upgrade cannot be overwritten.
  const retained = await recoveryRedis().eval(
    "local value = redis.call('get',KEYS[1]) if not value then return 0 end local record = cjson.decode(value) record.expiresAt = tonumber(ARGV[1]) redis.call('set',KEYS[1],cjson.encode(record),'EX',ARGV[2]) return 1",
    [recoveryKey(id)], [Date.now() + 7 * 86400000, 7 * 86400],
  );
  if (!retained) throw new Error("EVALUATION_EXPIRED");
  return id;
}

export async function findEvaluationCheckout(stripe: Stripe, email: string, id: string | null) {
  if (!id) return null;
  const key = "rubricheck:evaluationCheckout:" + ownerHash(email) + ":" + id;
  const previous = await recoveryRedis().get<string>(key);
  if (!previous) return null;
  const session = await stripe.checkout.sessions.retrieve(previous);
  return session.status === "expired" ? null : session;
}

// Reuse one checkout journey for a result, including requests from another tab.
export async function createEvaluationCheckout(stripe: Stripe, params: Stripe.Checkout.SessionCreateParams, email: string, id: string | null) {
  if (!id) return stripe.checkout.sessions.create(params);
  const redis = recoveryRedis();
  const key = "rubricheck:evaluationCheckout:" + ownerHash(email) + ":" + id;
  const previous = await redis.get<string>(key);
  if (previous) {
    const session = await stripe.checkout.sessions.retrieve(previous);
    if (session.status !== "expired") return session;
  }
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: key + ":" + (previous ?? "initial"),
  });
  await redis.set(key, session.id, { ex: 7 * 86400 });
  return session;
}

export function evaluationCheckoutFields(appUrl: string, id: string | null) {
  const query = id ? "&evaluation_id=" + encodeURIComponent(id) : "";
  return {
    success_url: appUrl.replace(/\/+$/, "") + "/?checkout_session_id={CHECKOUT_SESSION_ID}" + query,
    cancel_url: appUrl.replace(/\/+$/, "") + (id ? "/?evaluation_id=" + encodeURIComponent(id) + "&checkout_canceled=1" : "/billing/cancel"),
  };
}
