"use client";
import { useLanguage } from "../../components/LanguageProvider";


import Link from "next/link";
import { useEffect, useState } from "react";

import { useAccountSummary } from "../../components/AccountSummaryProvider";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

type CheckoutResponse = {
  url?: string;
  code?: string;
  message?: string;
  error?: string;
};

type CreditRefundSummaryResponse = {
  supported?: boolean;
  refundableCredits?: number;
  refundableAmount?: number;
  currency?: string | null;
  code?: string;
  message?: string;
  error?: string;
};

type BillingStatusResponse = {
  status?: "none" | "active" | "canceling" | "canceled";
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null;
  code?: string;
  message?: string;
  error?: string;
};

function formatCurrencyAmount(amount: number, currency: string | null, locale = "en"): string {
  if (!currency) {
    return `$${(amount / 100).toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDateFromEpoch(seconds: number | null, locale = "en"): string | null {
  if (!seconds || !Number.isFinite(seconds)) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(seconds * 1000));
  } catch {
    return null;
  }
}

export function BillingManageClient() {
  const { t, href, siteLanguage } = useLanguage();
  const { signedInEmail, accountPlan, remainingEvaluations, creditBalance, refreshAccountSummary } = useAccountSummary();
  const [billingPortalError, setBillingPortalError] = useState("");
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [showBillingPortalConfirm, setShowBillingPortalConfirm] = useState(false);
  const [showCreditRefundConfirm, setShowCreditRefundConfirm] = useState(false);
  const [creditRefundError, setCreditRefundError] = useState("");
  const [creditRefundNotice, setCreditRefundNotice] = useState("");
  const [isLoadingCreditRefundSummary, setIsLoadingCreditRefundSummary] = useState(false);
  const [isRefundingCredits, setIsRefundingCredits] = useState(false);
  const [creditRefundSummary, setCreditRefundSummary] = useState<{
    supported: boolean;
    refundableCredits: number;
    refundableAmount: number;
    currency: string | null;
  }>({
    supported: false,
    refundableCredits: 0,
    refundableAmount: 0,
    currency: null,
  });
  const [billingStatus, setBillingStatus] = useState<"none" | "active" | "canceling" | "canceled">("none");
  const [billingStatusPeriodEnd, setBillingStatusPeriodEnd] = useState<number | null>(null);
  const [billingStatusError, setBillingStatusError] = useState("");
  const hasProAccess = accountPlan === "pro";
  const hasManageableSubscription = billingStatus === "active" || billingStatus === "canceling";
  const shouldShowSubscriptionSection = hasProAccess || hasManageableSubscription;
  const displayPlan = hasProAccess ? "Pro" : (creditBalance ?? 0) > 0 ? t("Top-up") : "Free";
  const billingStatusDateLabel = formatDateFromEpoch(billingStatusPeriodEnd, siteLanguage);

  useEffect(() => {
    if (!signedInEmail) {
      setBillingStatus("none");
      setBillingStatusPeriodEnd(null);
      setBillingStatusError("");
      return;
    }

    let cancelled = false;

    async function loadBillingStatus() {
      setBillingStatusError("");

      try {
        const response = await fetch("/api/billing/status", {
          method: "GET",
          cache: "no-store",
        });
        const data: BillingStatusResponse = await response.json().catch(() => ({}));
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.code ?? data.error ?? "BILLING_STATUS_FETCH_FAILED");
        }

        setBillingStatus(
          data.status === "active" || data.status === "canceling" || data.status === "canceled" ? data.status : "none",
        );
        setBillingStatusPeriodEnd(
          typeof data.currentPeriodEnd === "number" && Number.isFinite(data.currentPeriodEnd) ? data.currentPeriodEnd : null,
        );
      } catch {
        if (!cancelled) {
          setBillingStatus("none");
          setBillingStatusPeriodEnd(null);
          setBillingStatusError("Unable to confirm the latest subscription status right now.");
        }
      }
    }

    void loadBillingStatus();

    return () => {
      cancelled = true;
    };
  }, [signedInEmail]);

  useEffect(() => {
    if (!signedInEmail) {
      setCreditRefundSummary({
        supported: false,
        refundableCredits: 0,
        refundableAmount: 0,
        currency: null,
      });
      setCreditRefundError("");
      setCreditRefundNotice("");
      return;
    }

    let cancelled = false;

    async function loadCreditRefundSummary() {
      setIsLoadingCreditRefundSummary(true);
      setCreditRefundError("");

      try {
        const response = await fetch("/api/credits/refund", {
          method: "GET",
          cache: "no-store",
        });
        const data: CreditRefundSummaryResponse = await response.json().catch(() => ({}));
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.code ?? data.error ?? "CREDIT_REFUND_SUMMARY_FAILED");
        }

        setCreditRefundSummary({
          supported: data.supported === true,
          refundableCredits:
            typeof data.refundableCredits === "number" && Number.isFinite(data.refundableCredits)
              ? Math.max(0, Math.floor(data.refundableCredits))
              : 0,
          refundableAmount:
            typeof data.refundableAmount === "number" && Number.isFinite(data.refundableAmount)
              ? Math.max(0, Math.floor(data.refundableAmount))
              : 0,
          currency: typeof data.currency === "string" ? data.currency : null,
        });
      } catch {
        if (!cancelled) {
          setCreditRefundError("Unable to load refundable top-ups right now.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCreditRefundSummary(false);
        }
      }
    }

    void loadCreditRefundSummary();

    return () => {
      cancelled = true;
    };
  }, [signedInEmail]);

  function requestOpenBillingPortal() {
    setBillingPortalError("");
    if (!signedInEmail || !hasManageableSubscription) {
      return;
    }

    setShowBillingPortalConfirm(true);
  }

  async function handleOpenBillingPortal() {
    setShowBillingPortalConfirm(false);
    setBillingPortalError("");
    if (!signedInEmail) {
      return;
    }

    setIsOpeningBillingPortal(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data: CheckoutResponse = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.code ?? data.error ?? "BILLING_PORTAL_SESSION_FAILED");
      }

      window.location.assign(data.url);
    } catch {
      setBillingPortalError(t("Unable to open subscription management right now. Please try again."));
    } finally {
      setIsOpeningBillingPortal(false);
    }
  }

  function requestRefundTopUps() {
    setCreditRefundError("");
    setCreditRefundNotice("");
    if (!signedInEmail) {
      return;
    }

    if (creditRefundSummary.refundableCredits <= 0 || creditRefundSummary.refundableAmount <= 0) {
      setCreditRefundError(t("There are no unused purchased credits to refund."));
      return;
    }

    setShowCreditRefundConfirm(true);
  }

  async function handleRefundTopUps() {
    setShowCreditRefundConfirm(false);
    setCreditRefundError("");
    setCreditRefundNotice("");
    if (!signedInEmail) {
      return;
    }

    setIsRefundingCredits(true);
    try {
      const response = await fetch("/api/credits/refund", {
        method: "POST",
      });
      const data: CreditRefundSummaryResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.code ?? data.error ?? "CREDIT_REFUND_FAILED");
      }

      setCreditRefundNotice(
        typeof data.message === "string" && data.message.trim()
          ? data.message
          : t("Unused purchased credits were refunded."),
      );
      setCreditRefundSummary((previous) => ({
        ...previous,
        refundableCredits: 0,
        refundableAmount: 0,
      }));
      await refreshAccountSummary();
    } catch (error) {
      const code = error instanceof Error ? error.message : "CREDIT_REFUND_FAILED";
      if (code === "NO_REFUNDABLE_TOPUPS") {
        setCreditRefundError(t("There are no unused purchased credits to refund."));
      } else if (code === "CREDIT_REFUND_UNSUPPORTED") {
        setCreditRefundError(t("Top-up refunds are not available in this environment."));
      } else {
        setCreditRefundError(t("Unable to refund unused top-ups right now. Please try again."));
      }
    } finally {
      setIsRefundingCredits(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <div className="mt-4">
          <h1 className="text-2xl font-semibold text-slate-900">{t("Billing and refunds")}</h1>
          <p className="mt-2 text-sm text-slate-600"> {t("Manage your subscription and refund unused purchased top-up credits from one place.")} </p>
        </div>

        {!signedInEmail ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"> {t("Log in first, then open this page from the account controls.")} <div className="mt-3">
              <Link
                href={href("/pricing")}
                className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-800 transition hover:bg-amber-100"
              > {t("Go to pricing")} </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <h2 className="text-lg font-semibold text-slate-900">{t("Subscription")}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {t("Account:")} <span className="font-semibold text-slate-900">{signedInEmail}</span>
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Plan")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{t(displayPlan)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Evaluations left")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {hasProAccess
                      ? "Unlimited"
                      : typeof remainingEvaluations === "number"
                          ? String(remainingEvaluations)
                          : "-"}
                  </p>
                </div>
              </div>
              {shouldShowSubscriptionSection ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Subscription status")}</p>
                    {billingStatus === "canceling" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800"> {t("Cancellation scheduled")} </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {billingStatus === "canceling"
                      ? billingStatusDateLabel
                        ? t("Canceled, active until {date}", { date: billingStatusDateLabel })
                        : t("Canceled, active until the current billing period ends")
                      : billingStatus === "active"
                        ? "Active"
                        : hasProAccess
                          ? t("Pro access is still syncing")
                          : t("No active subscription")}
                  </p>
                  {!hasProAccess && hasManageableSubscription ? (
                    <p className="mt-2 text-sm text-slate-600"> {t("A Stripe subscription was found for this email, but this account is still showing Free access in RubriCheck.")} </p>
                  ) : null}
                </div>
              ) : null}
              {billingStatusError ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {billingStatusError}
                </p>
              ) : null}
              {shouldShowSubscriptionSection ? (
                <>
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {!hasManageableSubscription
                      ? t("Subscription details are still syncing. Please refresh shortly if you recently changed billing.")
                      : billingStatus === "canceling"
                      ? billingStatusDateLabel
                        ? t("Renewal is canceled. Pro access remains active until {date}.", { date: billingStatusDateLabel })
                        : t("Renewal is canceled. Pro access remains active until the current billing period ends.")
                      : t("Canceling stops the next renewal. Pro access remains active until the current billing period ends.")}
                  </p>
                  {billingPortalError ? (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {billingPortalError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={requestOpenBillingPortal}
                    disabled={isOpeningBillingPortal || !hasManageableSubscription}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isOpeningBillingPortal ? t("Opening billing...") : t("Manage or cancel subscription")}
                  </button>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">{t("This account does not currently have an active Pro subscription.")}</p>
              )}
            </section>

            {accountPlan === "pro" ? null : (
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h2 className="text-lg font-semibold text-slate-900">{t("Unused top-up refund")}</h2>
                <p className="mt-2 text-sm text-slate-600"> {t("Only unused purchased credits can be refunded. The first 3 free evaluations are never refundable.")} </p>
                {creditRefundError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {creditRefundError}
                  </p>
                ) : null}
                {creditRefundNotice ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {t(creditRefundNotice)}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-slate-700">
                  {isLoadingCreditRefundSummary
                    ? t("Checking refundable top-ups...")
                    : creditRefundSummary.supported
                        ? creditRefundSummary.refundableCredits > 0
                          ? t("{count} purchased credits are refundable for {amount}.", { count: creditRefundSummary.refundableCredits, amount: formatCurrencyAmount(creditRefundSummary.refundableAmount, creditRefundSummary.currency, siteLanguage) })
                          : t("No unused purchased credits are currently refundable.")
                        : t("Top-up refunds are not configured in this environment.")}
                </p>
                <button
                  type="button"
                  onClick={requestRefundTopUps}
                  disabled={
                    !creditRefundSummary.supported ||
                    isLoadingCreditRefundSummary ||
                    isRefundingCredits ||
                    creditRefundSummary.refundableCredits <= 0 ||
                    creditRefundSummary.refundableAmount <= 0
                  }
                  className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRefundingCredits ? t("Refunding...") : t("Refund unused top-ups")}
                </button>
              </section>
            )}
          </div>
        )}

        {showBillingPortalConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label={t("Close subscription confirmation")}
              onClick={() => setShowBillingPortalConfirm(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="billing-portal-confirm-title"
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <h2 id="billing-portal-confirm-title" className="text-lg font-semibold text-slate-900"> {t("Open Stripe billing?")} </h2>
              <p className="mt-2 text-sm text-slate-600"> {t("You will be redirected to Stripe to manage or cancel your subscription. Continue?")} </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowBillingPortalConfirm(false)}
                  disabled={isOpeningBillingPortal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                > {t("Cancel")} </button>
                <button
                  type="button"
                  onClick={() => void handleOpenBillingPortal()}
                  disabled={isOpeningBillingPortal}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isOpeningBillingPortal ? t("Opening billing...") : t("Continue")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {showCreditRefundConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label={t("Close top-up refund confirmation")}
              onClick={() => setShowCreditRefundConfirm(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="credit-refund-confirm-title"
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <h2 id="credit-refund-confirm-title" className="text-lg font-semibold text-slate-900"> {t("Refund unused top-ups?")} </h2>
              <p className="mt-2 text-sm text-slate-600">
                {t("This will refund {count} unused purchased credits for {amount}. Continue?", { count: creditRefundSummary.refundableCredits, amount: formatCurrencyAmount(creditRefundSummary.refundableAmount, creditRefundSummary.currency, siteLanguage) })}
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreditRefundConfirm(false)}
                  disabled={isRefundingCredits}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                > {t("Cancel")} </button>
                <button
                  type="button"
                  onClick={() => void handleRefundTopUps()}
                  disabled={isRefundingCredits}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRefundingCredits ? t("Refunding...") : t("Continue")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
