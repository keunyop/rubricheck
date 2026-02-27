"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SubpageBackHomeLink } from "../components/SubpageBackHomeLink";

import { CREDIT_PACK_IDS, getCreditPackLabel, getCreditPackMarketingLabel, getCreditPackPriceLabel } from "../../src/config/creditPacks";
import { PRO_CHECKOUT_DISPLAY, type ProCheckoutPlan } from "../../src/config/proCheckout";

type CheckoutResponse = {
  url?: string;
  code?: string;
  message?: string;
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
  code?: string;
  error?: string;
};

type RestoreVerifyResponse = {
  ok?: boolean;
  plan?: string;
  status?: string;
  code?: string;
  message?: string;
  error?: string;
};

type RestoreStep = "email" | "code";
type PricingTab = "pro" | "topups";

const EMAIL_AVATAR_CLASS_NAME = "border-indigo-200 bg-indigo-100 text-indigo-700";
const NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() ?? "development";
const SHOW_BETA_BADGE = NEXT_PUBLIC_APP_ENV === "production";

function isValidEmail(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getEmailInitial(email: string): string {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return "?";
  }

  const firstCharacter = normalizedEmail.charAt(0).toUpperCase();
  return /^[A-Z0-9]$/.test(firstCharacter) ? firstCharacter : "?";
}

function getEmailInitialAvatarClassName(email: string): string {
  if (!email.trim()) {
    return EMAIL_AVATAR_CLASS_NAME;
  }

  return EMAIL_AVATAR_CLASS_NAME;
}

function getEvaluationStatusChip(plan: "free" | "pro", remainingEvaluations: number | null): {
  label: string;
  toneClassName: string;
} | null {
  if (plan === "pro") {
    return null;
  }

  if (typeof remainingEvaluations === "number") {
    if (remainingEvaluations <= 0) {
      return {
        label: "No evaluations left today",
        toneClassName: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    return {
      label: `${remainingEvaluations} evaluations left`,
      toneClassName: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "Remaining evaluations -",
    toneClassName: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

export function PricingClient() {
  const [signedInEmail, setSignedInEmail] = useState("");
  const [accountPlan, setAccountPlan] = useState<"free" | "pro">("free");
  const [remainingEvaluations, setRemainingEvaluations] = useState<number | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [activePricingTab, setActivePricingTab] = useState<PricingTab>("pro");

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
  const evaluationStatusChip = getEvaluationStatusChip(accountPlan, remainingEvaluations);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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
        setAccountPlan(data.plan === "pro" ? "pro" : "free");
        setRemainingEvaluations(remaining);
        setCheckoutEmail((previous) => (previous.trim() ? previous : email));
        setCreditCheckoutEmail((previous) => (previous.trim() ? previous : email));
      } else {
        setSignedInEmail("");
        setAccountPlan("free");
        setRemainingEvaluations(null);
      }

      setCreditBalance(balance);
    } catch {
      setSignedInEmail("");
      setAccountPlan("free");
      setRemainingEvaluations(null);
      setCreditBalance(null);
    }
  }, []);

  function openLoginModal() {
    setShowAccountMenu(false);
    setRestoreStep("email");
    setRestoreCode("");
    setRestoreError("");
    setRestoreInfo("");
    setShowLoginModal(true);
  }

  useEffect(() => {
    void refreshAccountSummary();
  }, [refreshAccountSummary]);

  useEffect(() => {
    if (!showAccountMenu) {
      return;
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode || !accountMenuRef.current?.contains(targetNode)) {
        setShowAccountMenu(false);
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [showAccountMenu]);

  async function handleLogout() {
    setShowAccountMenu(false);

    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      // Ignore network/logout failures and reset local session state.
    }

    setSignedInEmail("");
    setAccountPlan("free");
    setRemainingEvaluations(null);
    setCreditBalance(null);
    setShowLoginModal(false);
    setRestoreStep("email");
    setRestoreCode("");
    setRestoreError("");
    setRestoreInfo("");
  }

  async function handleUpgradeToPro() {
    setCheckoutError("");
    if (accountPlan === "pro") {
      setCheckoutError("This account is already on Pro. No additional checkout is needed.");
      return;
    }

    const normalizedEmail = checkoutEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setCheckoutError("Please enter your email before continuing.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setCheckoutError("Please enter a valid email address.");
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
        throw new Error(data.code ?? data.error ?? "CHECKOUT_SESSION_FAILED");
      }

      window.location.assign(data.url);
    } catch (error) {
      const code = error instanceof Error ? error.message : "CHECKOUT_SESSION_FAILED";
      if (code === "ALREADY_PRO_ACTIVE") {
        setCheckoutError("This email already has an active Pro subscription. Please log in instead of purchasing again.");
      } else {
        setCheckoutError("Unable to start checkout right now. Please try again.");
      }
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  async function handleBuyCredits(packId: (typeof CREDIT_PACK_IDS)[number]) {
    setCreditCheckoutError("");
    const normalizedEmail = creditCheckoutEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setCreditCheckoutError("Please enter your email before continuing.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setCreditCheckoutError("Please enter a valid email address.");
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
        throw new Error(data.error ?? data.code ?? "ENTITLEMENT_RESTORE_START_FAILED");
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
        throw new Error(data.error ?? data.code ?? "ENTITLEMENT_RESTORE_VERIFY_FAILED");
      }

      if (data.ok === true && data.plan === "pro" && data.status === "active") {
        setRestoreCode("");
        setRestoreStep("email");
        setShowLoginModal(false);
        await refreshAccountSummary();
        return;
      }

      setRestoreCode("");
      setRestoreStep("email");
      setShowLoginModal(false);
      await refreshAccountSummary();
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
          <SubpageBackHomeLink className="mb-3 inline-block text-sm font-medium text-indigo-700 transition hover:text-indigo-600" />
          <div className="border-b border-slate-100 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Image src="/rubricheck-logo.svg" alt="RubriCheck logo" width={135} height={36} className="mt-0.5 h-9 w-auto shrink-0" />
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pricing</h1>
                {SHOW_BETA_BADGE ? (
                  <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Beta
                  </span>
                ) : null}
              </div>
              <div className="inline-flex items-center gap-2">
                {signedInEmail ? (
                  <div ref={accountMenuRef} className="relative">
                    <button
                      type="button"
                      title={signedInEmail}
                      aria-haspopup="menu"
                      aria-expanded={showAccountMenu}
                      onClick={() => setShowAccountMenu((previous) => !previous)}
                      className="inline-flex items-center gap-2 px-0.5 py-0.5 transition hover:opacity-90"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${getEmailInitialAvatarClassName(signedInEmail)}`}
                      >
                        {getEmailInitial(signedInEmail)}
                      </span>
                      {evaluationStatusChip ? (
                        <p
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${evaluationStatusChip.toneClassName}`}
                        >
                          {evaluationStatusChip.label}
                        </p>
                      ) : null}
                      <span className="sr-only">{signedInEmail}</span>
                    </button>
                    {showAccountMenu ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                      >
                        <p className="truncate px-2 py-1 text-xs text-slate-500">{signedInEmail}</p>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleLogout()}
                          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Log out
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openLoginModal}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Log in
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-left text-sm text-slate-600 md:text-[15px]">
              Choose Pro subscription or one-time evaluation top-ups.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-300 bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setActivePricingTab("pro")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activePricingTab === "pro"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upgrade to Pro
            </button>
            <button
              type="button"
              onClick={() => setActivePricingTab("topups")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activePricingTab === "topups"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Evaluation Top-Ups
            </button>
          </div>

          {activePricingTab === "pro" ? (
            <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Upgrade to Pro</h2>
              {accountPlan === "pro" ? (
                <p className="mt-1 text-sm text-emerald-700">Pro is already active for this account.</p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Unlimited evaluations with richer feedback and rewrite suggestions for better scores.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-slate-200 p-1.5">
                <button
                  type="button"
                  onClick={() => setCheckoutPlan("monthly")}
                  disabled={isCreatingCheckout || accountPlan === "pro"}
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
                  disabled={isCreatingCheckout || accountPlan === "pro"}
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
                <p className="text-4xl font-bold leading-tight text-indigo-900">
                  {selectedCheckoutPlanDisplay.price}
                  <span className="ml-1 text-base font-semibold text-indigo-700">
                    {selectedCheckoutPlanDisplay.periodLabel}
                  </span>
                </p>
                {selectedCheckoutPlanDisplay.saveNote ? (
                  <p className="mt-1 text-sm text-indigo-700">{selectedCheckoutPlanDisplay.saveNote}</p>
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
                  disabled={isCreatingCheckout || accountPlan === "pro"}
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
                disabled={isCreatingCheckout || accountPlan === "pro"}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accountPlan === "pro" ? "Already on Pro" : isCreatingCheckout ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            </section>
          ) : (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <h2 className="text-xl font-semibold text-slate-900">Evaluation Top-Ups</h2>
              <p className="mt-1 text-base text-slate-600">One-time purchase. Credits apply to Evaluate only.</p>
              {typeof creditBalance === "number" ? (
                <p className="mt-1 text-base text-slate-600">Current credits: {creditBalance}</p>
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
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {CREDIT_PACK_IDS.map((packId) => (
                  <article
                    key={packId}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                      {getCreditPackMarketingLabel(packId)}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{getCreditPackLabel(packId)}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{getCreditPackPriceLabel(packId)}</p>
                    <p className="mt-2 text-sm text-slate-600">One-time payment</p>
                    <button
                      type="button"
                      onClick={() => void handleBuyCredits(packId)}
                      disabled={isCreatingCreditCheckout}
                      className="mt-4 w-full rounded-lg bg-slate-800 px-3 py-2 text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingCreditCheckout ? "Redirecting..." : "Top up"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
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
              Log in
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              We will send a one-time code to verify ownership before logging you in.
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
