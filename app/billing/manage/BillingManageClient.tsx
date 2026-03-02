"use client";

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

function formatCurrencyAmount(amount: number, currency: string | null): string {
  if (!currency) {
    return `$${(amount / 100).toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDateFromEpoch(seconds: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds)) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(seconds * 1000));
  } catch {
    return null;
  }
}

export function BillingManageClient() {
  const { signedInEmail, accountPlan, remainingEvaluations, creditBalance, refreshAccountSummary } = useAccountSummary();
  const [billingPortalError, setBillingPortalError] = useState("");
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
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
  const displayPlan = hasProAccess ? "Pro" : (creditBalance ?? 0) > 0 ? "Top-up" : "Free";
  const billingStatusDateLabel = formatDateFromEpoch(billingStatusPeriodEnd);

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

  async function handleOpenBillingPortal() {
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
      setBillingPortalError("Unable to open subscription management right now. Please try again.");
    } finally {
      setIsOpeningBillingPortal(false);
    }
  }

  async function handleRefundTopUps() {
    setCreditRefundError("");
    setCreditRefundNotice("");
    if (!signedInEmail) {
      return;
    }

    if (creditRefundSummary.refundableCredits <= 0 || creditRefundSummary.refundableAmount <= 0) {
      setCreditRefundError("There are no unused purchased credits to refund.");
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
          : "Unused purchased credits were refunded.",
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
        setCreditRefundError("There are no unused purchased credits to refund.");
      } else if (code === "CREDIT_REFUND_UNSUPPORTED") {
        setCreditRefundError("Top-up refunds are not available in this environment.");
      } else {
        setCreditRefundError("Unable to refund unused top-ups right now. Please try again.");
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
          <h1 className="text-2xl font-semibold text-slate-900">Billing and refunds</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage your subscription and refund unused purchased top-up credits from one place.
          </p>
        </div>

        {!signedInEmail ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Log in first, then open this page from the account controls.
            <div className="mt-3">
              <Link
                href="/pricing"
                className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Go to pricing
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Subscription</h2>
              <p className="mt-2 text-sm text-slate-600">
                Account: <span className="font-semibold text-slate-900">{signedInEmail}</span>
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{displayPlan}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evaluations left</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subscription status</p>
                    {billingStatus === "canceling" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        Cancellation scheduled
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {billingStatus === "canceling"
                      ? billingStatusDateLabel
                        ? `Canceled, active until ${billingStatusDateLabel}`
                        : "Canceled, active until the current billing period ends"
                      : billingStatus === "active"
                        ? "Active"
                        : hasProAccess
                          ? "Pro access is still syncing"
                          : "No active subscription"}
                  </p>
                  {!hasProAccess && hasManageableSubscription ? (
                    <p className="mt-2 text-sm text-slate-600">
                      A Stripe subscription was found for this email, but this account is still showing Free access in RubriCheck.
                    </p>
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
                      ? "Subscription details are still syncing. Please refresh shortly if you recently changed billing."
                      : billingStatus === "canceling"
                      ? billingStatusDateLabel
                        ? `Renewal is canceled. Pro access remains active until ${billingStatusDateLabel}.`
                        : "Renewal is canceled. Pro access remains active until the current billing period ends."
                      : "Canceling stops the next renewal. Pro access remains active until the current billing period ends."}
                  </p>
                  {billingPortalError ? (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {billingPortalError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleOpenBillingPortal()}
                    disabled={isOpeningBillingPortal || !hasManageableSubscription}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isOpeningBillingPortal ? "Opening billing..." : "Manage or cancel subscription"}
                  </button>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">This account does not currently have an active Pro subscription.</p>
              )}
            </section>

            {accountPlan === "pro" ? null : (
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Unused top-up refund</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Only unused purchased credits can be refunded. The first 3 free evaluations are never refundable.
                </p>
                {creditRefundError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {creditRefundError}
                  </p>
                ) : null}
                {creditRefundNotice ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {creditRefundNotice}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-slate-700">
                  {isLoadingCreditRefundSummary
                    ? "Checking refundable top-ups..."
                    : creditRefundSummary.supported
                        ? creditRefundSummary.refundableCredits > 0
                          ? `${creditRefundSummary.refundableCredits} purchased credits are refundable for ${formatCurrencyAmount(
                              creditRefundSummary.refundableAmount,
                              creditRefundSummary.currency,
                            )}.`
                          : "No unused purchased credits are currently refundable."
                        : "Top-up refunds are not configured in this environment."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleRefundTopUps()}
                  disabled={
                    !creditRefundSummary.supported ||
                    isLoadingCreditRefundSummary ||
                    isRefundingCredits ||
                    creditRefundSummary.refundableCredits <= 0 ||
                    creditRefundSummary.refundableAmount <= 0
                  }
                  className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRefundingCredits ? "Refunding..." : "Refund unused top-ups"}
                </button>
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
