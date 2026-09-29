"use client";

import Link from "next/link";
import { FeedbackInbox } from "./FeedbackInbox";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import type { AdminDashboardData as ServerDashboardData } from "../../src/lib/adminDashboard";

type AdminSubscriberRow = {
  email?: string | null;
  customerId?: string | null;
  plan?: "pro" | "topup" | "free";
  subscriptionStatus?: "active" | "canceled" | "none";
  currentPeriodEnd?: number | null;
  updatedAt?: string | null;
  remainingCredits?: number;
  freeEvaluationsUsed?: number;
  freeEvaluationsRemaining?: number;
  latestTopUpAt?: string | null;
};

type AdminDashboardResponse = {
  adminEmail?: string | null;
  generatedAt?: string;
  summary?: {
    knownUsers?: number;
    proUsers?: number;
    topUpUsers?: number;
    freeUsers?: number;
    remainingCredits?: number;
  };
  subscribers?: AdminSubscriberRow[];
  pagination?: ServerDashboardData["pagination"];
};

type AdminDashboardData = {
  adminEmail: string;
  pagination: ServerDashboardData["pagination"];
  generatedAt: string;
  summary: {
    knownUsers: number;
    proUsers: number;
    topUpUsers: number;
    freeUsers: number;
    remainingCredits: number;
  };
  subscribers: Array<{
    email: string | null;
    customerId: string | null;
    plan: "pro" | "topup" | "free";
    subscriptionStatus: "active" | "canceled" | "none";
    currentPeriodEnd: number | null;
    updatedAt: string | null;
    remainingCredits: number;
    freeEvaluationsUsed: number;
    freeEvaluationsRemaining: number;
    latestTopUpAt: string | null;
  }>;
};

type AdjustCreditsResponse = {
  ok?: boolean;
  email?: string;
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

function formatPeriodEnd(epochSeconds: number | null): string {
  if (!Number.isFinite(epochSeconds) || !epochSeconds || epochSeconds <= 0) {
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

function normalizeDashboardData(value: AdminDashboardResponse, fallbackAdminEmail: string): AdminDashboardData {
  const subscribers = Array.isArray(value.subscribers) ? value.subscribers : [];

  return {
    adminEmail: typeof value.adminEmail === "string" && value.adminEmail.trim() ? value.adminEmail : fallbackAdminEmail,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    pagination: {
      page: Math.max(1, normalizeNumber(value.pagination?.page)),
      pageSize: Math.max(1, normalizeNumber(value.pagination?.pageSize) || 25),
      total: Math.max(0, normalizeNumber(value.pagination?.total)),
      totalPages: Math.max(1, normalizeNumber(value.pagination?.totalPages)),
    },
    summary: {
      knownUsers: normalizeNumber(value.summary?.knownUsers),
      proUsers: normalizeNumber(value.summary?.proUsers),
      topUpUsers: normalizeNumber(value.summary?.topUpUsers),
      freeUsers: normalizeNumber(value.summary?.freeUsers),
      remainingCredits: normalizeNumber(value.summary?.remainingCredits),
    },
    subscribers: subscribers.map((row) => ({
      email: typeof row.email === "string" && row.email.trim() ? row.email : null,
      customerId: typeof row.customerId === "string" && row.customerId.trim() ? row.customerId : null,
      plan: row.plan === "pro" || row.plan === "topup" ? row.plan : "free",
      subscriptionStatus: row.subscriptionStatus === "active" || row.subscriptionStatus === "canceled" ? row.subscriptionStatus : "none",
      currentPeriodEnd: typeof row.currentPeriodEnd === "number" && Number.isFinite(row.currentPeriodEnd) ? row.currentPeriodEnd : null,
      updatedAt: typeof row.updatedAt === "string" && row.updatedAt.trim() ? row.updatedAt : null,
      remainingCredits: normalizeNumber(row.remainingCredits),
      freeEvaluationsUsed: normalizeNumber(row.freeEvaluationsUsed),
      freeEvaluationsRemaining: normalizeNumber(row.freeEvaluationsRemaining),
      latestTopUpAt: typeof row.latestTopUpAt === "string" && row.latestTopUpAt.trim() ? row.latestTopUpAt : null,
    })),
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

function planBadgeClassName(plan: "pro" | "topup" | "free"): string {
  if (plan === "pro") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (plan === "topup") {
    return "bg-sky-100 text-sky-700";
  }
  return "bg-slate-100 text-slate-700";
}

function subscriptionLabel(status: "active" | "canceled" | "none"): string {
  if (status === "active") {
    return "Active";
  }
  if (status === "canceled") {
    return "Canceled";
  }
  return "-";
}

export function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");
  const [listParams, setListParams] = useState({ page: 1, pageSize: 25, query: "" });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const searchPending = filterText.trim().toLowerCase() !== listParams.query;
  const [creditEmail, setCreditEmail] = useState("");
  const [creditDelta, setCreditDelta] = useState("10");
  const [creditNotice, setCreditNotice] = useState("");
  const [creditError, setCreditError] = useState("");
  const [adjustingCredits, setAdjustingCredits] = useState(false);

  const loadDashboard = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");

    try {
      const searchParams = new URLSearchParams({
        page: String(listParams.page),
        pageSize: String(listParams.pageSize),
        q: listParams.query,
      });
      const response = await fetch(`/api/admin/dashboard?${searchParams}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      const data: AdminDashboardResponse & { message?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to load admin dashboard.");
      }

      if (!controller.signal.aborted) {
        setDashboard(normalizeDashboardData(data, adminEmail));
      }
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load admin dashboard.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [adminEmail, listParams]);

  useEffect(() => {
    void loadDashboard();
    return () => activeRequest.current?.abort();
  }, [loadDashboard, refreshVersion]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const query = filterText.trim().toLowerCase();
      setListParams((current) => current.query === query ? current : { ...current, query, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
  }, [filterText]);

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

      setCreditNotice(`Updated ${data.email ?? creditEmail.trim().toLowerCase()}. New balance: ${data.balance ?? 0}.`);
      setRefreshVersion((current) => current + 1);
    } catch (submitError) {
      setCreditError(submitError instanceof Error ? submitError.message : "Unable to adjust credits.");
    } finally {
      setAdjustingCredits(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Operations dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                All known users from subscriptions, top-ups, and free-trial activity, with a simple Pro / Top-up / Free breakdown.
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

        <FeedbackInbox />

        {dashboard ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Known Users" value={String(dashboard.summary.knownUsers)} />
              <StatCard label="Pro" value={String(dashboard.summary.proUsers)} />
              <StatCard label="Top-Up" value={String(dashboard.summary.topUpUsers)} />
              <StatCard label="Free" value={String(dashboard.summary.freeUsers)} />
              <StatCard label="Credits Left" value={String(dashboard.summary.remainingCredits)} />
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.8fr)]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Subscriber roster</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Includes current Pro users, top-up holders, and free users with tracked activity.
                    </p>
                  </div>
                  <label className="block md:w-80">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
                    <input
                      type="text"
                      value={filterText}
                      maxLength={200}
                      onChange={(event) => setFilterText(event.target.value)}
                      placeholder="email, customer id, or plan"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                </div>
                <div aria-busy={loading || searchPending} className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Plan</th>
                        <th className="px-4 py-3 font-semibold">Subscription</th>
                        <th className="px-4 py-3 font-semibold">Credits</th>
                        <th className="px-4 py-3 font-semibold">Free trial</th>
                        <th className="px-4 py-3 font-semibold">Last top-up</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {dashboard.subscribers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                            {loading || searchPending ? "Loading subscribers..." : "No known user records match this filter."}
                          </td>
                        </tr>
                      ) : (
                        dashboard.subscribers.map((row) => {
                          const identityLabel = row.email ?? "email unavailable";
                          const canAdjustCredits = Boolean(row.email);

                          return (
                            <tr key={`${row.email ?? "no-email"}-${row.customerId ?? "no-customer"}`}>
                              <td className="px-4 py-3 align-top">
                                <p className="font-medium text-slate-900">{identityLabel}</p>
                                <p className="mt-1 text-xs text-slate-500">{row.customerId ?? "-"}</p>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${planBadgeClassName(row.plan)}`}>
                                  {row.plan === "pro" ? "Pro" : row.plan === "topup" ? "Top-up" : "Free"}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-slate-700">
                                <p>{subscriptionLabel(row.subscriptionStatus)}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatPeriodEnd(row.currentPeriodEnd)}</p>
                              </td>
                              <td className="px-4 py-3 align-top font-semibold text-slate-900">{row.remainingCredits}</td>
                              <td className="px-4 py-3 align-top text-slate-700">
                                {row.freeEvaluationsUsed} used / {row.freeEvaluationsRemaining} left
                              </td>
                              <td className="px-4 py-3 align-top text-slate-700">{formatDateTime(row.latestTopUpAt)}</td>
                              <td className="px-4 py-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!row.email) {
                                      return;
                                    }
                                    setCreditEmail(row.email);
                                    setCreditNotice("");
                                    setCreditError("");
                                  }}
                                  disabled={!canAdjustCredits}
                                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Adjust credits
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <nav aria-label="Subscriber pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <p role="status" aria-live="polite">
                    {loading || searchPending ? "Loading subscribers..." : (
                      <>
                        {dashboard.pagination.total === 0 ? 0 : (dashboard.pagination.page - 1) * dashboard.pagination.pageSize + 1}
                        {" - "}{Math.min(dashboard.pagination.page * dashboard.pagination.pageSize, dashboard.pagination.total)}
                        {" of "}{dashboard.pagination.total} subscribers
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      Per page
                      <select
                        value={listParams.pageSize}
                        disabled={loading || searchPending}
                        onChange={(event) => setListParams((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) }))}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 disabled:opacity-50"
                      >
                        {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={loading || searchPending || dashboard.pagination.page <= 1}
                      onClick={() => setListParams((current) => ({ ...current, page: dashboard.pagination.page - 1 }))}
                      className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span>Page {dashboard.pagination.page} of {dashboard.pagination.totalPages}</span>
                    <button
                      type="button"
                      disabled={loading || searchPending || dashboard.pagination.page >= dashboard.pagination.totalPages}
                      onClick={() => setListParams((current) => ({ ...current, page: dashboard.pagination.page + 1 }))}
                      className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </nav>
              </section>

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
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delta</span>
                    <input
                      type="number"
                      value={creditDelta}
                      onChange={(event) => setCreditDelta(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
