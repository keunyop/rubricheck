"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

import { CREDIT_PACK_IDS, getCreditPackLabel, getCreditPackMarketingLabel, getCreditPackPriceLabel } from "../../src/config/creditPacks";
import { PRO_CHECKOUT_DISPLAY, type ProCheckoutPlan } from "../../src/config/proCheckout";

type CheckoutResponse = {
  url?: string;
  error?: string;
};

type AccountSummaryResponse = {
  signedIn?: boolean;
  email?: string | null;
  plan?: "free" | "pro";
  remainingEvaluations?: number | null;
  creditsBalance?: number | null;
  error?: string;
};

type RestoreStartResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type RestoreVerifyResponse = {
  ok?: boolean;
  plan?: string;
  status?: string;
  error?: string;
};

type RestoreStep = "email" | "code";

function isValidEmail(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function PricingClient() {
  const [signedInEmail, setSignedInEmail] = useState("");
  const [remainingEvaluations, setRemainingEvaluations] = useState<number | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const [checkoutPlan, setCheckoutPlan] = useState<ProCheckoutPlan>("monthly");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);

  const [creditCheckoutEmail, setCreditCheckoutEmail] = useState("");
  const [creditCheckoutError, setCreditCheckoutError] = useState("");
  const [isCreatingCreditCheckout, setIsCreatingCreditCheckout] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [restoreStep, setRestoreStep] = useState<RestoreStep>("email");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreInfo, setRestoreInfo] = useState("");
  const [isStartingRestore, setIsStartingRestore] = useState(false);
  const [isVerifyingRestore, setIsVerifyingRestore] = useState(false);

  const selectedCheckoutPlanDisplay = PRO_CHECKOUT_DISPLAY[checkoutPlan];

  const refreshAccountSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/account/summary", {
        method: "GET",
        cache: "no-store",
      });
      const data: AccountSummaryResponse = await response.json().catch(() => ({}));
      const email = typeof data.email === "string" ? data.email.trim() : "";
      const remaining =
        typeof data.remainingEvaluations === "number" && Number.isFinite(data.remainingEvaluations)
          ? Math.max(0, Math.floor(data.remainingEvaluations))
          : null;
      const balance =
        typeof data.creditsBalance === "number" && Number.isFinite(data.creditsBalance)
          ? Math.max(0, Math.floor(data.creditsBalance))
          : null;

      if (response.ok && data.signedIn && email) {
        setSignedInEmail(email);
        setRemainingEvaluations(remaining);
        setCheckoutEmail((previous) => (previous.trim() ? previous : email));
        setCreditCheckoutEmail((previous) => (previous.trim() ? previous : email));
      } else {
        setSignedInEmail("");
        setRemainingEvaluations(null);
      }

      setCreditBalance(balance);
    } catch {
      setSignedInEmail("");
      setRemainingEvaluations(null);
      setCreditBalance(null);
    }
  }, []);

  useEffect(() => {
    void refreshAccountSummary();
  }, [refreshAccountSummary]);

  async function handleUpgradeToPro() {
    setCheckoutError("");
    const normalizedEmail = checkoutEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setCheckoutError("Please enter a valid email for Stripe checkout.");
      return;
    }

    setIsCreatingCheckout(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: checkoutPlan, email: normalizedEmail }),
      });

      const data: CheckoutResponse = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "CHECKOUT_SESSION_FAILED");
      }

      window.location.assign(data.url);
    } catch {
      setCheckoutError("Unable to start checkout right now. Please try again.");
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  async function handleBuyCredits(packId: (typeof CREDIT_PACK_IDS)[number]) {
    setCreditCheckoutError("");
    const normalizedEmail = creditCheckoutEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setCreditCheckoutError("Please enter a valid email for credit purchase.");
      return;
    }

    setIsCreatingCreditCheckout(true);

    try {
      const response = await fetch("/api/checkout/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packId, email: normalizedEmail }),
      });

      const data: CheckoutResponse = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "CREDIT_CHECKOUT_SESSION_FAILED");
      }

      window.location.assign(data.url);
    } catch {
      setCreditCheckoutError("Unable to start credit checkout right now. Please try again.");
    } finally {
      setIsCreatingCreditCheckout(false);
    }
  }

  async function handleStartRestorePro() {
    setRestoreError("");
    setRestoreInfo("");

    const normalizedEmail = restoreEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setRestoreError("Please enter a valid email.");
      return;
    }

    setIsStartingRestore(true);
    try {
      const response = await fetch("/api/entitlement/restore/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data: RestoreStartResponse = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "ENTITLEMENT_RESTORE_START_FAILED");
      }

      setRestoreEmail(normalizedEmail);
      setRestoreStep("code");
      setRestoreInfo("Verification code sent. Check your inbox.");
      setRestoreError("");
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_RESTORE_START_FAILED";
      if (code === "EMAIL_REQUIRED") {
        setRestoreError("Please enter a valid email.");
        return;
      }
      if (code === "RATE_LIMITED") {
        setRestoreError("Too many attempts. Please wait and try again.");
        return;
      }
      if (code === "SERVICE_UNAVAILABLE") {
        setRestoreError("Restore is temporarily unavailable. Please try again shortly.");
        return;
      }
      setRestoreError("Unable to start restore right now. Please try again.");
    } finally {
      setIsStartingRestore(false);
    }
  }

  async function handleVerifyRestorePro() {
    setRestoreError("");
    setRestoreInfo("");

    const normalizedEmail = restoreEmail.trim().toLowerCase();
    const normalizedCode = restoreCode.trim();

    if (!isValidEmail(normalizedEmail)) {
      setRestoreError("Please enter a valid email.");
      setRestoreStep("email");
      return;
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      setRestoreError("Enter the 6-digit code.");
      return;
    }

    setIsVerifyingRestore(true);
    try {
      const response = await fetch("/api/entitlement/restore/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });

      const data: RestoreVerifyResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "ENTITLEMENT_RESTORE_VERIFY_FAILED");
      }

      if (data.ok === true && data.plan === "pro" && data.status === "active") {
        setRestoreCode("");
        setRestoreStep("email");
        setShowLoginModal(false);
        await refreshAccountSummary();
        return;
      }

      setRestoreError("No active Pro subscription found for this email.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_RESTORE_VERIFY_FAILED";
      if (code === "INVALID_CODE") {
        setRestoreError("Invalid or expired code. Please try again.");
        return;
      }
      if (code === "RATE_LIMITED") {
        setRestoreError("Too many attempts. Please wait and try again.");
        return;
      }
      if (code === "SERVICE_UNAVAILABLE") {
        setRestoreError("Restore is temporarily unavailable. Please try again shortly.");
        return;
      }

      setRestoreError("Unable to verify restore right now. Please try again.");
    } finally {
      setIsVerifyingRestore(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] px-4 py-10 md:py-14">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <Image src="/rubricheck-logo.svg" alt="RubriCheck logo" width={135} height={36} className="h-9 w-auto" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pricing</h1>
                <p className="mt-2 text-sm text-slate-600 md:text-[15px]">
                  Choose Pro subscription or one-time evaluation top-ups.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2">
              {signedInEmail ? (
                <div className="max-w-[13rem] rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-800">
                  <p className="truncate">{signedInEmail}</p>
                  <p className="mt-0.5">
                    Remaining evaluations: {typeof remainingEvaluations === "number" ? remainingEvaluations : "-"}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  Log in
                </button>
              )}
            </div>
          </div>

          <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Upgrade to Pro</h2>
            <p className="mt-1 text-sm text-slate-600">
              Up to 30 evaluations/day with richer feedback and rewrite tools.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-slate-200 p-1.5">
              <button
                type="button"
                onClick={() => setCheckoutPlan("monthly")}
                disabled={isCreatingCheckout}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                  checkoutPlan === "monthly"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCheckoutPlan("annual")}
                disabled={isCreatingCheckout}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                  checkoutPlan === "annual"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                Annual
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
              <p className="text-sm font-semibold text-indigo-900">
                {selectedCheckoutPlanDisplay.price}
                <span className="ml-1 text-xs font-medium text-indigo-700">
                  {selectedCheckoutPlanDisplay.periodLabel}
                </span>
              </p>
              {selectedCheckoutPlanDisplay.saveNote ? (
                <p className="mt-1 text-xs text-indigo-700">{selectedCheckoutPlanDisplay.saveNote}</p>
              ) : null}
            </div>
            <label htmlFor="pricing-upgrade-email" className="mt-3 block">
              <span className="text-xs font-semibold text-slate-700">Email</span>
              <input
                id="pricing-upgrade-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={checkoutEmail}
                onChange={(event) => {
                  setCheckoutEmail(event.target.value);
                  setCheckoutError("");
                }}
                disabled={isCreatingCheckout}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            {checkoutError ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {checkoutError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleUpgradeToPro}
              disabled={isCreatingCheckout || !checkoutEmail.trim()}
              className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingCheckout ? "Redirecting..." : "Upgrade to Pro"}
            </button>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Evaluation Top-Ups</h2>
            <p className="mt-1 text-sm text-slate-600">One-time purchase. Credits apply to Evaluate only.</p>
            {typeof creditBalance === "number" ? (
              <p className="mt-1 text-xs text-slate-600">Current credits: {creditBalance}</p>
            ) : null}
            <label htmlFor="pricing-credit-email" className="mt-3 block">
              <span className="text-xs font-semibold text-slate-700">Email</span>
              <input
                id="pricing-credit-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={creditCheckoutEmail}
                onChange={(event) => {
                  setCreditCheckoutEmail(event.target.value);
                  setCreditCheckoutError("");
                }}
                disabled={isCreatingCreditCheckout}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            {creditCheckoutError ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {creditCheckoutError}
              </p>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {CREDIT_PACK_IDS.map((packId) => (
                <article key={packId} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    {getCreditPackMarketingLabel(packId)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{getCreditPackLabel(packId)}</p>
                  <p className="mt-1 text-xs text-slate-600">{getCreditPackPriceLabel(packId)}</p>
                  <button
                    type="button"
                    onClick={() => void handleBuyCredits(packId)}
                    disabled={isCreatingCreditCheckout || !creditCheckoutEmail.trim()}
                    className="mt-3 w-full rounded-md bg-slate-800 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingCreditCheckout ? "Redirecting..." : "Top up"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>

      {showLoginModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close login modal"
            onClick={() => setShowLoginModal(false)}
            className="absolute inset-0 bg-slate-950/45"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-login-title"
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h3 id="pricing-login-title" className="text-lg font-semibold text-slate-900">
              Log in (Restore Pro)
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              We will send a one-time code to verify ownership before restoring your Pro session.
            </p>
            <label htmlFor="pricing-restore-email" className="mt-4 block">
              <span className="text-xs font-semibold text-slate-700">Email</span>
              <input
                id="pricing-restore-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={restoreEmail}
                onChange={(event) => {
                  setRestoreEmail(event.target.value);
                  setRestoreError("");
                }}
                disabled={isStartingRestore || isVerifyingRestore}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            {restoreStep === "code" ? (
              <label htmlFor="pricing-restore-code" className="mt-3 block">
                <span className="text-xs font-semibold text-slate-700">Verification code</span>
                <input
                  id="pricing-restore-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={restoreCode}
                  onChange={(event) => {
                    setRestoreCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setRestoreError("");
                  }}
                  disabled={isStartingRestore || isVerifyingRestore}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.2em] text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
            ) : null}
            {restoreInfo ? (
              <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                {restoreInfo}
              </p>
            ) : null}
            {restoreError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {restoreError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {restoreStep === "code" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreStep("email");
                      setRestoreCode("");
                      setRestoreError("");
                      setRestoreInfo("");
                    }}
                    disabled={isStartingRestore || isVerifyingRestore}
                    className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleVerifyRestorePro()}
                    disabled={isStartingRestore || isVerifyingRestore || !restoreCode.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifyingRestore ? "Verifying..." : "Verify & Log in"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStartRestorePro()}
                  disabled={isStartingRestore || isVerifyingRestore || !restoreEmail.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStartingRestore ? "Sending..." : "Send code"}
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
