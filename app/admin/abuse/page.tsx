"use client";

import { useCallback, useMemo, useState } from "react";

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
    <div className="rounded border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1">Key</th>
            <th className="py-1">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={2} className="py-2 text-slate-400">No data</td></tr>
          ) : rows.map((row) => (
            <tr key={row.key}>
              <td className="py-1 font-mono text-[11px]">{row.key}</td>
              <td className="py-1">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AbuseAdminPage() {
  const [secret, setSecret] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/abuse-metrics", {
        headers: {
          "x-admin-secret": secret,
        },
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

  const totals = useMemo(() => {
    if (!metrics) return null;
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
    <main className="mx-auto max-w-7xl space-y-4 p-6 text-sm">
      <header className="rounded border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold">Abuse Telemetry</h1>
        <p className="text-xs text-slate-500">Mode: {metrics?.enforcementMode ?? "monitor"}</p>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="ADMIN_SECRET"
            className="w-72 rounded border border-slate-300 px-2 py-1"
          />
          <button onClick={refresh} disabled={loading} className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-60">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Last updated: {metrics ? new Date(metrics.generatedAt).toLocaleString() : "never"}</p>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </header>

      {totals ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border border-slate-200 bg-white p-4">Total: 1h {totals.total1h} | 24h {totals.total24h}</div>
          <div className="rounded border border-slate-200 bg-white p-4">Suspicious: 1h {totals.suspicious1h} | 24h {totals.suspicious24h}</div>
          <div className="rounded border border-slate-200 bg-white p-4">Errors: 1h {totals.errors1h} | 24h {totals.errors24h}</div>
        </section>
      ) : null}

      {metrics ? (
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Endpoint Summary</h2>
          <table className="w-full text-left text-xs">
            <thead><tr><th>Endpoint</th><th>Total 1h</th><th>Suspicious 1h</th><th>Error 1h</th><th>Total 24h</th><th>Suspicious 24h</th><th>Error 24h</th></tr></thead>
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

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">Recent suspicious events</h2>
        <table className="w-full text-left text-xs">
          <thead><tr><th>Time</th><th>Endpoint</th><th>Score</th><th>Reasons</th><th>Request ID</th></tr></thead>
          <tbody>
            {(metrics?.recentSuspiciousEvents ?? []).length === 0 ? (
              <tr><td colSpan={5} className="py-2 text-slate-400">No suspicious events yet.</td></tr>
            ) : (metrics?.recentSuspiciousEvents ?? []).map((event) => (
              <tr key={event.requestId}>
                <td className="py-1">{new Date(event.timestamp).toLocaleString()}</td>
                <td className="font-mono">{event.endpoint}</td>
                <td>{event.score}</td>
                <td>{event.reasons.join(", ")}</td>
                <td className="font-mono">{event.requestId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
