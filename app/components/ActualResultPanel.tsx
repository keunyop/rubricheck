"use client";

import { useId, useState, type FormEvent } from "react";
import { actualResultInputSchema, ASSIGNMENT_TYPES, ASSIGNMENT_TYPE_LABELS, compareActualResult, type ActualResult, type ActualResultInput } from "../../src/lib/actualResultTypes";
import { formatOverallScoreDisplay, SCORE_RANGE_NOTICE } from "../../src/lib/scorePresentation";

const inputStyle = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const buttonStyle = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const number = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

export function ActualResultPanel({ evaluationId }: { evaluationId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [record, setRecord] = useState<ActualResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const id = useId();
  const url = "/api/workspace/assignments/" + encodeURIComponent(evaluationId) + "/actual-result";

  async function request(method: "GET" | "PUT" | "DELETE", body?: unknown) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, cache: "no-store",
        ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(data.message || "Could not access your actual result. Please try again.");
      }
      if (!Object.hasOwn(data, "actualResult")) throw new Error("Could not load your actual result. Please try again.");
      setRecord(data.actualResult); setLoaded(true); setConflict(false); setFormVersion(value => value + 1);
      if (method !== "GET") setNotice(method === "DELETE" ? "Actual result deleted. Your AI evaluation is still saved." : "Actual result saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not access your actual result. Please try again.");
    } finally { setBusy(false); }
  }

  return <section aria-label="Actual score and comments" data-html2canvas-ignore="true" className="my-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-slate-900">Actual score and comments</h3>
        <p className="mt-1 text-sm text-slate-600">After your assignment is graded, keep the result and compare it with this AI estimate.</p></div>
      <button type="button" className={buttonStyle} aria-expanded={open} aria-controls={id} disabled={busy}
        onClick={() => { setOpen(!open); if (!open && !loaded) void request("GET"); }}>
        {open ? "Close actual result" : loaded && record ? "View actual score and comments" : "Add actual score and comments"}
      </button>
    </div>
    {open && <div id={id} className="mt-5">
      {busy && !loaded && <p role="status" className="text-sm text-slate-600">Loading actual result...</p>}
      {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p>
        {(!loaded || conflict) && <button type="button" className={buttonStyle + " mt-2"} disabled={busy} onClick={() => void request("GET")}>{conflict ? "Reload saved record" : "Try again"}</button>}
        {conflict && <p className="mt-2">Reloading replaces your unsaved edits with the latest saved record.</p>}
      </div>}
      {notice && <p role="status" className="mb-4 text-sm text-emerald-800">{notice}</p>}
      {loaded && <ActualResultForm key={formVersion} record={record} busy={busy} blocked={conflict}
        onSave={input => request("PUT", input)} onDelete={() => request("DELETE", { expectedRevision: record?.revision ?? null })} />}
    </div>}
  </section>;
}

function ActualResultForm({ record, busy, blocked, onSave, onDelete }: {
  record: ActualResult | null; busy: boolean; blocked: boolean; onSave: (input: ActualResultInput) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const id = useId();
  const [score, setScore] = useState(record?.score == null ? "" : String(record.score));
  const [maxScore, setMaxScore] = useState(String(record?.maxScore ?? 100));
  const [comment, setComment] = useState(record?.comment ?? "");
  const [course, setCourse] = useState(record?.course ?? "");
  const [assignmentType, setAssignmentType] = useState(record?.assignmentType ?? "unspecified");
  const [submissionMatch, setSubmissionMatch] = useState(record?.submissionMatch ?? "unknown");
  const [personalRecord, setPersonalRecord] = useState(record?.consent.personalRecord ?? false);
  const [qualityValidation, setQualityValidation] = useState(record?.consent.qualityValidation ?? false);
  const [publicCase, setPublicCase] = useState(record?.consent.publicCase ?? false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const comparison = record ? compareActualResult(record) : null;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const input = actualResultInputSchema.safeParse({
      score: score.trim() === "" ? null : Number(score), maxScore: maxScore.trim() === "" ? 0 : Number(maxScore),
      comment, course, assignmentType, submissionMatch, consent: { personalRecord, qualityValidation, publicCase },
      expectedRevision: record?.revision ?? null,
    });
    if (!input.success) { setError("Enter a score between zero and the maximum, or a comment, and confirm personal record storage."); return; }
    await onSave(input.data);
  }

  return <>
    {record && <div aria-label="Saved actual result comparison" className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">Saved result · {new Date(record.updatedAt).toLocaleDateString()}</p>
      {comparison ? <>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">AI estimate at the time</dt><dd className="mt-1 font-semibold text-slate-900">{formatOverallScoreDisplay(record.estimate.overallRange)} / 100</dd></div>
          <div><dt className="text-slate-500">Actual score</dt><dd className="mt-1 font-semibold text-slate-900">{number(record.score!)} / {number(record.maxScore)} ({number(comparison.actualPercent)}%)</dd></div>
          <div><dt className="text-slate-500">Actual minus AI midpoint</dt><dd className="mt-1 font-semibold text-slate-900">{comparison.difference > 0 ? "+" : ""}{number(comparison.difference)} percentage points</dd></div>
        </dl>
        <p className="mt-3 text-sm text-slate-700">{comparison.withinRange ? "Within the estimated range." : "Outside the estimated range by " + number(comparison.distanceOutsideRange) + " percentage points."}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{SCORE_RANGE_NOTICE} The midpoint is a comparison reference, not a separate predicted grade.</p>
      </> : <p className="mt-2 text-sm text-slate-600">Comment saved. Add a numeric score to compare results.</p>}
      {record.submissionMatch !== "same" && <p className="mt-2 text-xs leading-5 text-amber-800">The submitted work was revised or has not been confirmed as the same draft. This difference cannot be attributed to AI error alone.</p>}
    </div>}
    <form onSubmit={submit}>
      <fieldset disabled={busy || blocked} className="space-y-4 disabled:opacity-60">
        <legend className="sr-only">Record your actual result</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-sm font-medium text-slate-700" htmlFor={id + "-score"}>Actual score (optional)</label>
            <input id={id + "-score"} className={inputStyle} type="number" min="0" max={Number(maxScore) || undefined} step="any" value={score} onChange={event => setScore(event.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor={id + "-max"}>Maximum score</label>
            <input id={id + "-max"} className={inputStyle} type="number" min="0.000001" max="1000000" step="any" required value={maxScore} onChange={event => setMaxScore(event.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor={id + "-course"}>Course / subject (optional)</label>
            <input id={id + "-course"} className={inputStyle} maxLength={80} value={course} onChange={event => setCourse(event.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor={id + "-type"}>Assignment type</label>
            <select id={id + "-type"} className={inputStyle} value={assignmentType} onChange={event => setAssignmentType(event.target.value as ActualResult["assignmentType"])}>
              {ASSIGNMENT_TYPES.map(type => <option key={type} value={type}>{ASSIGNMENT_TYPE_LABELS[type]}</option>)}</select></div>
        </div>
        <div><label className="block text-sm font-medium text-slate-700" htmlFor={id + "-match"}>Was the graded submission the same draft as this AI check?</label>
          <select id={id + "-match"} className={inputStyle} value={submissionMatch} onChange={event => setSubmissionMatch(event.target.value as ActualResult["submissionMatch"])}>
            <option value="unknown">Not sure / not specified</option><option value="same">Yes, the same draft</option><option value="revised">No, I revised it before submission</option>
          </select></div>
        <div><label className="block text-sm font-medium text-slate-700" htmlFor={id + "-comment"}>Assignment comments (optional)</label>
          <textarea id={id + "-comment"} className={inputStyle} rows={4} maxLength={5000} value={comment} onChange={event => setComment(event.target.value)} placeholder="Instructor feedback or your own notes" /></div>
        <p className="text-xs text-slate-500">Enter a score, a comment, or both. Avoid names, student IDs and other personal details in comments.</p>
        <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Choose how this record may be used</legend>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input className="mt-1 shrink-0" type="checkbox" required checked={personalRecord} onChange={event => setPersonalRecord(event.target.checked)} /><span>Save to my personal record (required to save). I can edit or delete it later.</span></label>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input className="mt-1 shrink-0" type="checkbox" checked={qualityValidation} onChange={event => setQualityValidation(event.target.checked)} /><span>Allow service quality validation (optional). Use this result, comments and saved AI estimate to study errors, range coverage and repeated-run variation internally.</span></label>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input className="mt-1 shrink-0" type="checkbox" checked={publicCase} onChange={event => setPublicCase(event.target.checked)} /><span>Allow an anonymized public case (optional). The saved AI estimate, actual score, assignment type and comments may illustrate both useful estimates and misses. This does not publish automatically.</span></label>
          <p className="text-xs leading-5 text-slate-500">Optional choices are independent and do not affect grading or access. To withdraw either permission, uncheck it and save. Deleting removes this record and both permissions.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Please wait..." : "Save actual result"}</button>
          {record && <button type="button" className={buttonStyle} onClick={() => setConfirmDelete(true)}>Delete actual result</button>}
        </div>
        {confirmDelete && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p>Delete this score, comments and permissions? Your AI evaluation will remain saved.</p><div className="mt-3 flex gap-3"><button type="button" className={buttonStyle} onClick={() => void onDelete()}>Confirm deletion</button><button type="button" className={buttonStyle} onClick={() => setConfirmDelete(false)}>Keep record</button></div></div>}
      </fieldset>
    </form>
  </>;
}
