"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AdminSubscriberRow = {
  email: string;
  customerId: string;
  status: "active" | "canceled";
  currentPeriodEnd: number;
  updatedAt: string | null;
  remainingCredits: number;
  freeEvaluationsUsed: number;
  freeEvaluationsRemaining: number;
  latestTopUpAt: string | null;
};

type AdminPaymentRow = {
  id: number;
  ownerType: "customer" | "email";
  ownerId: string;
  customerId: string | null;
  purchaserEmail: string | null;
  creditPackId: string | null;
  credits: number;
  amountTotal: number | null;
  currency: string | null;
  createdAt: string | null;
};

type AdminWebhookFailure = {
  eventId: string;
  eventType: string;
  customerId: string | null;
  subscriptionId: string | null;
  sessionId: string | null;
  requestId: string | null;
  errorMessage: string;
  failedAt: string | null;
};

type AdminDashboardResponse = {
  adminEmail?: string | null;
  generatedAt?: string;
  summary?: {
    activeSubscribers?: number;
    inactiveSubscribers?: number;
    trackedSubscribers?: number;
    subscriberCredits?: number;
    topUpCreditsSold30d?: number;
    webhookFailures24h?: number;
    suspiciousRequests1h?: number;
    totalRequests1h?: number;
  };
  abuse?: {
    enforcementMode?: "monitor" | "enforce";
    totalRequests1h?: number;
    suspiciousRequests1h?: number;
    errorRequests1h?: number;
    totalRequests24h?: number;
    suspiciousRequests24h?: number;
    errorRequests24h?: number;
  };
  subscribers?: AdminSubscriberRow[];
  recentPayments?: AdminPaymentRow[];
  recentWebhookFailures?: AdminWebhookFailure[];
};

type AdminDashboardData = {
  adminEmail: string;
  generatedAt: string;
  summary: {
    activeSubscribers: number;
    inactiveSubscribers: number;
    trackedSubscribers: number;
    subscriberCredits: number;
    topUpCreditsSold30d: number;
    webhookFailures24h: number;
    suspiciousRequests1h: number;
    totalRequests1h: number;
  };
  abuse: {
    enforcementMode: "monitor" | "enforce";
    totalRequests1h: number;
    suspiciousRequests1h: number;
    errorRequests1h: number;
    totalRequests24h: number;
    suspiciousRequests24h: number;
    errorRequests24h: number;
  };
  subscribers: AdminSubscriberRow[];
  recentPayments: AdminPaymentRow[];
  recentWebhookFailures: AdminWebhookFailure[];
};

type AdjustCreditsResponse = {
  ok?: boolean;
  email?: string;
  delta?: number;
  balance?: number;
  message?: string;
};

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPeriodEnd(epochSeconds: number): string {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(epochSeconds * 1000));
  } catch {
    return String(epochSeconds);
  }
}

function formatCurrency(cents: number | null, currency: string | null): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "-";
  }

  if (!currency) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function normalizeDashboardData(value: AdminDashboardResponse, fallbackAdminEmail: string): AdminDashboardData {
  return {
    adminEmail: typeof value.adminEmail === "string" && value.adminEmail.trim() ? value.adminEmail : fallbackAdminEmail,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    summary: {
      activeSubscribers: normalizeNumber(value.summary?.activeSubscribers),
      inactiveSubscribers: normalizeNumber(value.summary?.inactiveSubscribers),
      trackedSubscribers: normalizeNumber(value.summary?.trackedSubscribers),
      subscriberCredits: normalizeNumber(value.summary?.subscriberCredits),
      topUpCreditsSold30d: normalizeNumber(value.summary?.topUpCreditsSold30d),
      webhookFailures24h: normalizeNumber(value.summary?.webhookFailures24h),
      suspiciousRequests1h: normalizeNumber(value.summary?.suspiciousRequests1h),
      totalRequests1h: normalizeNumber(value.summary?.totalRequests1h),
    },
    abuse: {
      enforcementMode: value.abuse?.enforcementMode === "enforce" ? "enforce" : "monitor",
      totalRequests1h: normalizeNumber(value.abuse?.totalRequests1h),
      suspiciousRequests1h: normalizeNumber(value.abuse?.suspiciousRequests1h),
      errorRequests1h: normalizeNumber(value.abuse?.errorRequests1h),
      totalRequests24h: normalizeNumber(value.abuse?.totalRequests24h),
      suspiciousRequests24h: normalizeNumber(value.abuse?.suspiciousRequests24h),
      errorRequests24h: normalizeNumber(value.abuse?.errorRequests24h),
    },
    subscribers: Array.isArray(value.subscribers) ? value.subscribers : [],
    recentPayments: Array.isArray(value.recentPayments) ? value.recentPayments : [],
    recentWebhookFailures: Array.isArray(value.recentWebhookFailures) ? value.recentWebhookFailures : [],
  };
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-slate-500">{sublabel}</p> : null}
    </article>
  );
}

export function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");
  const [creditEmail, setCreditEmail] = useState("");
  const [creditDelta, setCreditDelta] = useState("10");
  const [creditNotice, setCreditNotice] = useState("");
  const [creditError, setCreditError] = useState("");
  const [adjustingCredits, setAdjustingCredits] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/dashboard", {
        method: "GET",
        cache: "no-store",
      });
      const data: AdminDashboardResponse & { message?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to load admin dashboard.");
      }

      setDashboard(normalizeDashboardData(data, adminEmail));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filteredSubscribers = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const query = filterText.trim().toLowerCase();
    if (!query) {
      return dashboard.subscribers;
    }

    return dashboard.subscribers.filter((row) =>
      row.email.includes(query) || row.customerId.toLowerCase().includes(query),
    );
  }, [dashboard, filterText]);

  async function handleAdjustCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreditNotice("");
    setCreditError("");

    const delta = Number.parseInt(creditDelta.trim(), 10);
    if (!Number.isFinite(delta) || delta === 0) {
      setCreditError("Enter a non-zero whole number for the credit adjustment.");
      return;
    }

    setAdjustingCredits(true);
    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: creditEmail,
          delta,
        }),
      });
      const data: AdjustCreditsResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to adjust credits.");
      }

      setCreditNotice(
        `Updated ${data.email ?? creditEmail.trim().toLowerCase()} by ${delta > 0 ? "+" : ""}${delta}. New balance: ${data.balance ?? 0}.`,
      );
      await loadDashboard();
    } catch (submitError) {
      setCreditError(submitError instanceof Error ? submitError.message : "Unable to adjust credits.");
    } finally {
      setAdjustingCredits(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">Admin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Operations dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Subscriber roster, remaining evaluation credits, recent top-ups, webhook failures, and abuse telemetry in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {adminEmail}
              </span>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                disabled={loading}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link
                href="/admin/abuse"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Abuse telemetry
              </Link>
            </div>
          </div>
          {dashboard?.generatedAt ? (
            <p className="mt-3 text-xs text-slate-500">Last updated: {formatDateTime(dashboard.generatedAt)}</p>
          ) : null}
          {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </header>

        {dashboard ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Active Subscribers"
                value={String(dashboard.summary.activeSubscribers)}
                sublabel={`${dashboard.summary.inactiveSubscribers} inactive records`}
              />
              <StatCard
                label="Subscriber Credits"
                value={String(dashboard.summary.subscriberCredits)}
                sublabel="Remaining evaluation credits across subscriber accounts"
              />
              <StatCard
                label="Top-Ups 30d"
                value={String(dashboard.summary.topUpCreditsSold30d)}
                sublabel="Credits sold in the last 30 days"
              />
              <StatCard
                label="Abuse 1h"
                value={`${dashboard.summary.suspiciousRequests1h}/${dashboard.summary.totalRequests1h}`}
                sublabel={`Mode: ${dashboard.abuse.enforcementMode}`}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Subscriber roster</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Latest {dashboard.summary.trackedSubscribers} entitlement records with remaining credits and free-eval usage.
                    </p>
                  </div>
                  <label className="block md:w-80">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
                    <input
                      type="text"
                      value={filterText}
                      onChange={(event) => setFilterText(event.target.value)}
                      placeholder="email or customer id"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                </div>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Period end</th>
                        <th className="px-4 py-3 font-semibold">Credits</th>
                        <th className="px-4 py-3 font-semibold">Free used</th>
                        <th className="px-4 py-3 font-semibold">Last top-up</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredSubscribers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                            No subscriber records match this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredSubscribers.map((row) => (
                          <tr key={`${row.customerId}-${row.email}`}>
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium text-slate-900">{row.email}</p>
                              <p className="mt-1 font-mono text-xs text-slate-500">{row.customerId}</p>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  row.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {row.status === "active" ? "Active" : "Canceled"}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">{formatPeriodEnd(row.currentPeriodEnd)}</td>
                            <td className="px-4 py-3 align-top font-semibold text-slate-900">{row.remainingCredits}</td>
                            <td className="px-4 py-3 align-top text-slate-700">
                              {row.freeEvaluationsUsed} used / {row.freeEvaluationsRemaining} left
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">{formatDateTime(row.latestTopUpAt)}</td>
                            <td className="px-4 py-3 align-top">
                              <button
                                type="button"
                                onClick={() => {
                                  setCreditEmail(row.email);
                                  setCreditNotice("");
                                  setCreditError("");
                                }}
                                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                              >
                                Adjust credits
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Adjust evaluation credits</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Use a positive number to add credits or a negative number to deduct them.
                  </p>
                  <form className="mt-4 space-y-3" onSubmit={handleAdjustCredits}>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account email</span>
                      <input
                        type="email"
                        value={creditEmail}
                        onChange={(event) => setCreditEmail(event.target.value)}
                        placeholder="user@example.com"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delta</span>
                      <input
                        type="number"
                        value={creditDelta}
                        onChange={(event) => setCreditDelta(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        required
                      />
                    </label>
                    {creditNotice ? (
                      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {creditNotice}
                      </p>
                    ) : null}
                    {creditError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{creditError}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={adjustingCredits}
                      className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {adjustingCredits ? "Updating..." : "Apply credit adjustment"}
                    </button>
                  </form>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Operations snapshot</h2>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="font-medium text-slate-900">Abuse telemetry</p>
                      <p className="mt-1">1h: {dashboard.abuse.suspiciousRequests1h} suspicious / {dashboard.abuse.totalRequests1h} total</p>
                      <p className="mt-1">24h errors: {dashboard.abuse.errorRequests24h}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="font-medium text-slate-900">Webhook failures</p>
                      <p className="mt-1">{dashboard.summary.webhookFailures24h} failures recorded in the last 24 hours.</p>
                    </div>
                  </div>
                </section>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Recent top-up payments</h2>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">When</th>
                        <th className="px-4 py-3 font-semibold">Purchaser</th>
                        <th className="px-4 py-3 font-semibold">Credits</th>
                        <th className="px-4 py-3 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {dashboard.recentPayments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            No recent top-up payments.
                          </td>
                        </tr>
                      ) : (
                        dashboard.recentPayments.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 align-top text-slate-700">{formatDateTime(row.createdAt)}</td>
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium text-slate-900">{row.purchaserEmail ?? row.ownerId}</p>
                              <p className="mt-1 text-xs text-slate-500">{row.creditPackId ?? "manual/unknown"}</p>
                            </td>
                            <td className="px-4 py-3 align-top font-semibold text-slate-900">{row.credits}</td>
                            <td className="px-4 py-3 align-top text-slate-700">{formatCurrency(row.amountTotal, row.currency)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Recent webhook failures</h2>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">When</th>
                        <th className="px-4 py-3 font-semibold">Event</th>
                        <th className="px-4 py-3 font-semibold">Request</th>
                        <th className="px-4 py-3 font-semibold">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {dashboard.recentWebhookFailures.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            No recent webhook failures.
                          </td>
                        </tr>
                      ) : (
                        dashboard.recentWebhookFailures.map((row) => (
                          <tr key={`${row.eventId}-${row.failedAt ?? "na"}`}>
                            <td className="px-4 py-3 align-top text-slate-700">{formatDateTime(row.failedAt)}</td>
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium text-slate-900">{row.eventType}</p>
                              <p className="mt-1 text-xs text-slate-500">{row.eventId}</p>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">{row.requestId ?? "-"}</td>
                            <td className="px-4 py-3 align-top text-slate-700">{row.errorMessage}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
