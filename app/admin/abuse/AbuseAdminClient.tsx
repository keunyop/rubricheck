"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Endpoint = "evaluate" | "otp_start" | "otp_verify" | "checkout_session";

type Metrics = {
  generatedAt: string;
  enforcementMode: "monitor" | "enforce";
  last1h: {
    totalRequestsByEndpoint: Record<Endpoint, number>;
    suspiciousRequestsByEndpoint: Record<Endpoint, number>;
    errorRequestsByEndpoint: Record<Endpoint, number>;
  };
  last24h: {
    totalRequestsByEndpoint: Record<Endpoint, number>;
    suspiciousRequestsByEndpoint: Record<Endpoint, number>;
    errorRequestsByEndpoint: Record<Endpoint, number>;
  };
  recentSuspiciousEvents: Array<{
    timestamp: string;
    requestId: string;
    endpoint: Endpoint;
    score: number;
    reasons: string[];
  }>;
};

const ENDPOINTS: Endpoint[] = ["evaluate", "otp_start", "otp_verify", "checkout_session"];

function sumValues(record: Record<Endpoint, number>): number {
  return Object.values(record).reduce((acc, value) => acc + value, 0);
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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

export function AbuseAdminClient() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/abuse-metrics", {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed (${response.status})`);
      }

      setMetrics((await response.json()) as Metrics);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(() => {
    if (!metrics) {
      return null;
    }

    return {
      total1h: sumValues(metrics.last1h.totalRequestsByEndpoint),
      suspicious1h: sumValues(metrics.last1h.suspiciousRequestsByEndpoint),
      errors1h: sumValues(metrics.last1h.errorRequestsByEndpoint),
      total24h: sumValues(metrics.last24h.totalRequestsByEndpoint),
      suspicious24h: sumValues(metrics.last24h.suspiciousRequestsByEndpoint),
      errors24h: sumValues(metrics.last24h.errorRequestsByEndpoint),
    };
  }, [metrics]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-sm">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Abuse telemetry</h1>
              <p className="mt-1 text-sm text-slate-600">
                Simplified abuse view with totals, endpoint breakdown, and recent suspicious events.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Back to dashboard
              </Link>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Mode: {metrics?.enforcementMode ?? "monitor"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Last updated: {metrics ? formatDateTime(metrics.generatedAt) : "never"}
          </p>
          {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </header>

        {totals ? (
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="Requests 1h" value={String(totals.total1h)} sublabel={`${totals.total24h} in the last 24h`} />
            <StatCard
              label="Suspicious"
              value={String(totals.suspicious1h)}
              sublabel={`${totals.suspicious24h} suspicious requests in the last 24h`}
            />
            <StatCard label="Errors" value={String(totals.errors1h)} sublabel={`${totals.errors24h} errors in the last 24h`} />
          </section>
        ) : null}

        {metrics ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Endpoint summary</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Endpoint</th>
                    <th className="px-4 py-3 font-semibold">Total 1h</th>
                    <th className="px-4 py-3 font-semibold">Suspicious 1h</th>
                    <th className="px-4 py-3 font-semibold">Errors 1h</th>
                    <th className="px-4 py-3 font-semibold">Total 24h</th>
                    <th className="px-4 py-3 font-semibold">Suspicious 24h</th>
                    <th className="px-4 py-3 font-semibold">Errors 24h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {ENDPOINTS.map((endpoint) => (
                    <tr key={endpoint}>
                      <td className="px-4 py-3 font-mono text-slate-900">{endpoint}</td>
                      <td className="px-4 py-3 text-slate-700">{metrics.last1h.totalRequestsByEndpoint[endpoint]}</td>
                      <td className="px-4 py-3 text-slate-700">{metrics.last1h.suspiciousRequestsByEndpoint[endpoint]}</td>
                      <td className="px-4 py-3 text-slate-700">{metrics.last1h.errorRequestsByEndpoint[endpoint]}</td>
                      <td className="px-4 py-3 text-slate-700">{metrics.last24h.totalRequestsByEndpoint[endpoint]}</td>
                      <td className="px-4 py-3 text-slate-700">{metrics.last24h.suspiciousRequestsByEndpoint[endpoint]}</td>
                      <td className="px-4 py-3 text-slate-700">{metrics.last24h.errorRequestsByEndpoint[endpoint]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent suspicious events</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Reasons</th>
                  <th className="px-4 py-3 font-semibold">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(metrics?.recentSuspiciousEvents ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No suspicious events yet.
                    </td>
                  </tr>
                ) : (
                  (metrics?.recentSuspiciousEvents ?? []).map((event) => (
                    <tr key={event.requestId}>
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(event.timestamp)}</td>
                      <td className="px-4 py-3 font-mono text-slate-900">{event.endpoint}</td>
                      <td className="px-4 py-3 text-slate-700">{event.score}</td>
                      <td className="px-4 py-3 text-slate-700">{event.reasons.join(", ")}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{event.requestId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
