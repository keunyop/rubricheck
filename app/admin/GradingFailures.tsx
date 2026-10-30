"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GradingFailureDetail, GradingFailurePage, GradingFailureSummary } from "../../src/lib/gradingFailureTypes";

const endpoint = "/api/admin/grading-failures";
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";
const date = (value: number) => new Date(value).toLocaleString();
const stages = { file_parsing: "File extraction", rubric_structuring: "Rubric interpretation", ai_evaluation: "AI grading", finalization: "Result validation", trial_result_storage: "Preview storage" };

export function GradingFailures() {
  const [items, setItems] = useState<GradingFailureSummary[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<GradingFailureDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const pending = useRef(false);
  const retryOffset = useRef(0);

  const load = useCallback(async (offset = 0) => {
    if (pending.current) return;
    pending.current = true; retryOffset.current = offset; setLoading(true); setError("");
    try {
      const response = await fetch(endpoint + "?offset=" + offset, { cache: "no-store" });
      const data: GradingFailurePage & { message?: string } = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load grading failures.");
      setItems(previous => offset === 0 ? data.items : [...previous, ...data.items.filter(item => !previous.some(old => old.id === item.id))]);
      if (offset === 0) { setDetail(null); setConfirmDelete(null); }
      setNextOffset(data.nextOffset); setLoaded(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load grading failures."); }
    finally { pending.current = false; setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function open(id: string) {
    if (busy || loading) return;
    if (detail?.id === id) { setDetail(null); return; }
    setBusy(id); setError(""); setDetail(null); setConfirmDelete(null);
    try {
      const response = await fetch(endpoint + "?id=" + id, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to open this record.");
      setDetail(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to open this record."); }
    finally { setBusy(null); }
  }
  async function remove(id: string) {
    if (busy || loading) return;
    setBusy(id); setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Could not delete the record. Please retry.");
      setConfirmDelete(null); setDetail(null);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not delete the record."); }
    finally { setBusy(null); }
  }

  return <section aria-labelledby="grading-failures-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="grading-failures-title" className="text-lg font-semibold text-slate-900">Grading failures</h2>
        <p className="mt-1 text-sm text-slate-600">Failed checks from the last 7 days. Originals are private and expire automatically.</p>
      </div>
      <button type="button" className={buttonClass} disabled={loading || Boolean(busy)} onClick={() => void load()}>Refresh failures</button>
    </div>
    {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="font-semibold underline" disabled={loading || Boolean(busy)} onClick={() => void load(retryOffset.current)}>Retry loading failures</button></div>}
    {loaded && !items.length && !loading && !error && <p className="py-8 text-center text-sm text-slate-500">No grading failures in the last 7 days.</p>}
    <div className="mt-4 space-y-3">
      {items.map(item => <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-900">{stages[item.stage]} <span className="ml-2 break-all font-mono text-xs text-red-700">{item.code}</span></p>
            <p className="mt-1 break-all text-slate-600">{item.accountEmail ?? "Guest"} · {item.mode} · {item.language}</p>
            <p className="mt-1 text-xs text-slate-500"><time dateTime={new Date(item.createdAt).toISOString()}>{date(item.createdAt)}</time> · Expires {date(item.expiresAt)}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">Request: {item.requestId}</p>
            {item.captureStatus === "metadata_only" && <p className="mt-1 text-xs text-amber-700">Metadata only — originals were not retained for this attempt.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={loading || Boolean(busy)} aria-expanded={detail?.id === item.id} aria-controls={"failure-" + item.id} onClick={() => void open(item.id)}>{busy === item.id ? "Working..." : detail?.id === item.id ? "Close details" : "View details"}</button>
            <button type="button" className={buttonClass + " text-red-700"} disabled={loading || Boolean(busy)} onClick={() => setConfirmDelete(item.id)}>Delete record</button>
          </div>
        </div>
        {confirmDelete === item.id && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <p>Permanently delete this record and its originals?</p>
          <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void remove(item.id)}>Delete permanently</button>
          <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => setConfirmDelete(null)}>Cancel</button>
        </div>}
        {detail?.id === item.id && <div id={"failure-" + item.id} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {detail.captureNote && <p className="text-sm text-amber-800">{detail.captureNote}</p>}
          <p className="break-all text-xs text-slate-500">Models: {detail.structureModel ?? "unknown"} / {detail.evaluationModel ?? "unknown"} · Source: {detail.inputs.rubricSource} · Revision: {detail.deployment ?? "local / unknown"}</p>
          <a href={`${endpoint}?id=${item.id}&download=1`} className="inline-block text-sm font-semibold text-indigo-700 underline">Download diagnostic JSON</a>
          {([
            ["Original rubric text", detail.inputs.rubricText], ["Original assignment text", detail.inputs.assignmentText],
            ["Assignment instructions", detail.inputs.assignmentInstructions], ["Extracted rubric text", detail.inputs.extractedRubricText],
            ["Extracted assignment text", detail.inputs.extractedAssignmentText],
          ] as const).map(([label, text]) => text !== null && text !== "" ? <div key={label}>
            <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{text}</pre>
          </div> : null)}
          {detail.files.length > 0 && <div><h3 className="text-sm font-semibold text-slate-800">Original files</h3><ul className="mt-2 space-y-2 text-sm">
            {detail.files.map((file, index) => <li key={index} className="break-all">{file.field}: {file.name} ({file.size.toLocaleString()} bytes) {detail.captureStatus === "complete" && <a className="ml-2 font-semibold text-indigo-700 underline" href={`${endpoint}?id=${item.id}&file=${index}`}>Download original</a>}</li>)}
          </ul></div>}
        </div>}
      </article>)}
    </div>
    {loading && <p role="status" className="py-5 text-center text-sm text-slate-500">Loading grading failures...</p>}
    {nextOffset !== null && <div className="mt-4 text-center"><button type="button" className={buttonClass} disabled={loading || Boolean(busy)} onClick={() => void load(nextOffset)}>Load older failures</button></div>}
  </section>;
}
