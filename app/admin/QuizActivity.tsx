"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminQuizMetrics } from "../../src/lib/adminQuizMetrics";

export function QuizActivity() {
  const [data, setData] = useState<AdminQuizMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (refresh = false) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/quizzes" + (refresh ? "?refresh=1" : ""), { cache: "no-store", signal: controller.signal });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || "Unable to load quiz activity. Please retry.");
      if (!value.totals || !value.generation || !["complete", "partial"].includes(value.coverage)) throw new Error("Unable to load quiz activity. Please retry.");
      if (!controller.signal.aborted) setData(value);
    } catch (error) {
      if (!controller.signal.aborted) { setData(null); setError(error instanceof Error ? error.message : "Unable to load quiz activity. Please retry."); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  const count = (value: number) => (data?.coverage === "partial" ? "≥ " : "") + value.toLocaleString();
  return <section aria-labelledby="quiz-activity-title" aria-busy={loading} className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="quiz-activity-title" className="text-lg font-semibold text-slate-900">Quiz activity</h2><p className="mt-1 text-sm text-slate-500">Stored records. Deleted quizzes and practice sessions are excluded.</p></div>
      <button type="button" onClick={() => void load(true)} disabled={loading} className="min-h-10 rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50">{loading ? "Refreshing..." : "Refresh quizzes"}</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && !data && <p role="status" className="py-6 text-sm text-slate-500">Loading quiz activity...</p>}
    {data && <>
      {data.coverage === "partial" && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Partial snapshot. Counts are minimums from {data.scannedAccounts.toLocaleString()} scanned accounts.</p>}
      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Quiz users", data.totals.users], ["Saved quizzes", data.totals.quizzes], ["Questions", data.totals.questions], ["Practice sessions", data.totals.attempts]].map(([label, value]) => <div key={label} className="rounded-xl bg-teal-50/70 p-4"><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="mt-2 text-2xl font-semibold text-teal-900">{count(Number(value))}</dd></div>)}
      </dl>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
        {[["Completed sessions", data.totals.completedAttempts], ["Review sessions", data.totals.reviewAttempts], ["Completed generations", data.generation.completed], ["In progress", data.generation.inProgress], ["Failed", data.generation.failed], ["Interrupted", data.generation.interrupted]].map(([label, value]) => <div key={label} className="flex gap-2"><dt>{label}</dt><dd className="font-semibold text-slate-900">{count(Number(value))}</dd></div>)}
      </dl>
      <p className="mt-4 text-xs text-slate-500">Updated <time dateTime={data.generatedAt}>{new Date(data.generatedAt).toLocaleString()}</time></p>
    </>}
  </section>;
}
