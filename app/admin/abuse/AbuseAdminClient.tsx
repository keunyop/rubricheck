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
  topIpsByRequestCount: Array<{ key: string; count: number }>;
  topIpsBySuspiciousCount: Array<{ key: string; count: number }>;
  otpAnomalies: {
    ipsByDistinctEmails10m: Array<{ key: string; count: number }>;
    ipsByDistinctEmails1h: Array<{ key: string; count: number }>;
    emailsByDistinctIps10m: Array<{ key: string; count: number }>;
    emailsByDistinctIps1h: Array<{ key: string; count: number }>;
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

function Table({ title, rows }: { title: string; rows: Array<{ key: string; count: number }> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1">Key</th>
            <th className="py-1">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-2 text-slate-400">
                No data
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key}>
                <td className="py-1 font-mono text-[11px]">{row.key}</td>
                <td className="py-1">{row.count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AbuseAdminClient() {
  const [secret, setSecret] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers: HeadersInit = {};
      if (secret.trim()) {
        headers["x-admin-secret"] = secret.trim();
      }

      const response = await fetch("/api/admin/abuse-metrics", {
        headers,
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
  }, [secret]);

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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] p-6 text-sm">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">Admin</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Abuse telemetry</h1>
              <p className="mt-1 text-sm text-slate-600">Endpoint volumes, suspicious traffic, OTP anomalies, and recent flagged events.</p>
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
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <label className="block md:w-80">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin secret override</span>
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Optional ADMIN_SECRET"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Mode: {metrics?.enforcementMode ?? "monitor"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Last updated: {metrics ? new Date(metrics.generatedAt).toLocaleString() : "never"}
          </p>
          {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </header>

        {totals ? (
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">Total: 1h {totals.total1h} | 24h {totals.total24h}</div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              Suspicious: 1h {totals.suspicious1h} | 24h {totals.suspicious24h}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">Errors: 1h {totals.errors1h} | 24h {totals.errors24h}</div>
          </section>
        ) : null}

        {metrics ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold text-slate-900">Endpoint summary</h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Total 1h</th>
                  <th>Suspicious 1h</th>
                  <th>Error 1h</th>
                  <th>Total 24h</th>
                  <th>Suspicious 24h</th>
                  <th>Error 24h</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((endpoint) => (
                  <tr key={endpoint}>
                    <td className="py-1 font-mono">{endpoint}</td>
                    <td>{metrics.last1h.totalRequestsByEndpoint[endpoint]}</td>
                    <td>{metrics.last1h.suspiciousRequestsByEndpoint[endpoint]}</td>
                    <td>{metrics.last1h.errorRequestsByEndpoint[endpoint]}</td>
                    <td>{metrics.last24h.totalRequestsByEndpoint[endpoint]}</td>
                    <td>{metrics.last24h.suspiciousRequestsByEndpoint[endpoint]}</td>
                    <td>{metrics.last24h.errorRequestsByEndpoint[endpoint]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Table title="Top IP hashes by request count (1h)" rows={metrics?.topIpsByRequestCount ?? []} />
          <Table title="Top IP hashes by suspicious count (1h)" rows={metrics?.topIpsBySuspiciousCount ?? []} />
          <Table title="OTP anomaly: distinct email hashes per IP (10m)" rows={metrics?.otpAnomalies.ipsByDistinctEmails10m ?? []} />
          <Table title="OTP anomaly: distinct email hashes per IP (1h)" rows={metrics?.otpAnomalies.ipsByDistinctEmails1h ?? []} />
          <Table title="OTP anomaly: distinct IP hashes per email hash (10m)" rows={metrics?.otpAnomalies.emailsByDistinctIps10m ?? []} />
          <Table title="OTP anomaly: distinct IP hashes per email hash (1h)" rows={metrics?.otpAnomalies.emailsByDistinctIps1h ?? []} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">Recent suspicious events</h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th>Time</th>
                <th>Endpoint</th>
                <th>Score</th>
                <th>Reasons</th>
                <th>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {(metrics?.recentSuspiciousEvents ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-2 text-slate-400">
                    No suspicious events yet.
                  </td>
                </tr>
              ) : (
                (metrics?.recentSuspiciousEvents ?? []).map((event) => (
                  <tr key={event.requestId}>
                    <td className="py-1">{new Date(event.timestamp).toLocaleString()}</td>
                    <td className="font-mono">{event.endpoint}</td>
                    <td>{event.score}</td>
                    <td>{event.reasons.join(", ")}</td>
                    <td className="font-mono">{event.requestId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
