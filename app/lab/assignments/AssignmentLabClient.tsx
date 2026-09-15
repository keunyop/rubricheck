"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { compareConditions, compareCriteria, type LabAssignmentSummary, type LabRun, type LabTask, type LabWorkspace } from "../../../src/lib/assignmentLab/types";
import styles from "./lab.module.css";

const API = "/api/lab/assignments";
async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, body === undefined
    ? { cache: "no-store" }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request failed. Please try again.");
  return data as T;
}
const range = (values: number[]) => values.join("–");
const statusLabels = { new: "New issue", remaining: "Still needs work", resolved: "AI: addressed", uncertain: "Needs review" };

function TextInput({ label, value, onChange, disabled, upload }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean;
  upload: (file: File, set: (text: string) => void) => void;
}) {
  return <label className={styles.field}>
    <span className={styles.fieldHeading}>{label}<span className={styles.hint}>{value.length.toLocaleString()} / 60,000</span></span>
    <textarea value={value} onChange={event => onChange(event.target.value)} maxLength={60000} required disabled={disabled} rows={7} placeholder={"Paste " + label.toLowerCase() + " here"} />
    <span className={styles.upload}>Or upload PDF, DOCX or TXT · max 3 MB
      <input type="file" aria-label={"Upload " + label.toLowerCase()} accept=".pdf,.docx,.txt" disabled={disabled} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (file) upload(file, onChange);
      }} />
    </span>
  </label>;
}

function TaskCard({ task, criterion, disabled, toggle }: { task: LabTask; criterion: string; disabled: boolean; toggle: () => void }) {
  return <article className={styles.task}>
    <div className={styles.taskTop}><span className={styles[task.status]}>{statusLabels[task.status]}</span><span className={styles.hint}>{criterion}</span></div>
    <details>
      <summary>{task.title}</summary>
      <dl className={styles.taskDetail}>
        <dt>Why revise this?</dt><dd>{task.reason}</dd>
        <dt>Evidence needed</dt><dd>{task.required_evidence}</dd>
        <dt>Check your revision</dt><dd>{task.question}</dd>
        {task.review_reason && <><dt>Latest review</dt><dd>{task.review_reason}</dd></>}
      </dl>
      {task.evidence.map((quote, i) => <blockquote key={i}>{quote}</blockquote>)}
    </details>
    <label className={styles.checkbox}><input type="checkbox" checked={task.user_done} disabled={disabled} onChange={toggle} />I have worked on this item</label>
  </article>;
}

function Conditions({ run }: { run: LabRun }) {
  return <details className={styles.details}><summary>Evaluation conditions · {run.conditions.mode}</summary>
    <dl className={styles.conditions}>{Object.entries(run.conditions).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
  </details>;
}

export function AssignmentLabClient() {
  const [assignments, setAssignments] = useState<LabAssignmentSummary[]>([]);
  const [workspace, setWorkspace] = useState<LabWorkspace | null>(null);
  const [plan, setPlan] = useState("free");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [rubric, setRubric] = useState("");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("standard");
  const [revision, setRevision] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const creation = useRef<{ payload: string; id: string } | null>(null);
  const actionLock = useRef(false);

  async function refreshList() {
    const result = await api<{ assignments: LabAssignmentSummary[]; plan: string }>(API);
    setAssignments(result.assignments);
    setPlan(result.plan);
    return result.assignments;
  }
  function applyWorkspace(next: LabWorkspace, runId?: string) {
    setWorkspace(next); setCreating(false); setConfirmDelete(false);
    const latest = next.runs.at(-1);
    setSelectedVersion(next.runs.find(run => run.id === runId)?.version ?? latest?.version ?? 0);
    setRevision(latest?.draft_text ?? next.assignment.initial_draft);
    window.history.replaceState(null, "", "/lab/assignments?id=" + next.assignment.id);
  }
  async function action(fn: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(""); setMessage("");
    try { await fn(); } catch (cause) { setMessage(""); setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { actionLock.current = false; setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await api<{ assignments: LabAssignmentSummary[]; plan: string }>(API);
        if (!active) return;
        setAssignments(result.assignments); setPlan(result.plan);
        const id = new URL(window.location.href).searchParams.get("id") ?? result.assignments[0]?.id;
        if (id) {
          const next = await api<LabWorkspace>(API + "?id=" + encodeURIComponent(id));
          if (active) {
            setWorkspace(next); setSelectedVersion(next.runs.at(-1)?.version ?? 0);
            setRevision(next.runs.at(-1)?.draft_text ?? next.assignment.initial_draft);
          }
        } else setCreating(true);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Unable to load the lab."); }
      finally { if (active) setLoading(false); }
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  const disabled = busy || loading;
  const current = workspace?.runs.find(run => run.version === selectedVersion);
  const previous = workspace?.runs.find(run => run.version === selectedVersion - 1);
  const changedConditions = current && previous ? compareConditions(previous.conditions, current.conditions) : [];
  const atAssignmentLimit = plan !== "pro" && assignments.length >= 1;
  const atVersionLimit = workspace && workspace.runs.length >= (plan === "pro" ? 50 : 2);

  const upload = (file: File, set: (text: string) => void) => { void action(async () => {
    if (file.size > 3 * 1024 * 1024) throw new Error("Upload a file under 3 MB.");
    const body = new FormData(); body.set("file", file);
    setMessage("Reading your file…");
    const response = await fetch(API + "/parse", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Unable to read this file.");
    set(result.text); setMessage("File text is ready. Review it before evaluating.");
  }); };

  async function evaluate(next: LabWorkspace, text: string) {
    setMessage(next.runs.length ? "Reviewing your revision with the saved rubric…" : "Evaluating V1 and preparing your checklist…");
    const result = await api<{ workspace: LabWorkspace; reused: boolean; runId: string }>(API + "/evaluate", { id: next.assignment.id, draftText: text });
    applyWorkspace(result.workspace, result.runId);
    setMessage(result.reused ? "Identical text and conditions: showing the saved result. No new version was created." : "Your evaluation and revision checklist are saved.");
    await refreshList();
  }

  const panel = (children: ReactNode) => <section className={styles.panel}>{children}</section>;
  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><Link href="/" className={styles.brand}>RubriCheck</Link><span className={styles.labBadge}>PRIVATE LAB</span></div>
      <span className={styles.hint}>{plan === "pro" ? "Pro · multiple assignments" : "Free trial · 1 assignment, V1 + V2"}</span>
    </header>
    <div className={styles.intro}><p className={styles.eyebrow}>YOUR NEXT DRAFT, WITH A CLEAR DIRECTION</p><h1>Assignment revision workspace</h1><p>Keep your drafts together. See what changed, what still needs attention, and what to work on next.</p></div>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" disabled={disabled} onClick={() => { void action(async () => { await refreshList(); if (workspace) applyWorkspace(await api<LabWorkspace>(API + "?id=" + workspace.assignment.id)); }); }}>Reload saved work</button></div>}
    {message && <p role="status" className={styles.notice}>{busy ? "◌ " : ""}{message}</p>}
    {loading ? <p role="status" className={styles.panel}>Loading your assignments…</p> : <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeading}><h2>Your assignments</h2><span>{assignments.length}</span></div>
        <button className={styles.primary} disabled={disabled || atAssignmentLimit} onClick={() => { setCreating(true); setError(""); setMessage(""); }}>+ New assignment</button>
        {atAssignmentLimit && <p className={styles.hint}>Your free workspace is in use. Pro supports multiple assignments.</p>}
        <nav aria-label="Saved assignments" className={styles.assignmentList}>{assignments.map(item => <button disabled={disabled} key={item.id} aria-current={!creating && workspace?.assignment.id === item.id ? "page" : undefined} onClick={() => { void action(async () => applyWorkspace(await api<LabWorkspace>(API + "?id=" + item.id))); }}>
          <strong>{item.title}</strong><span>{item.run_count ? item.run_count + " saved version" + (item.run_count === 1 ? "" : "s") : "Ready for V1"}</span>
        </button>)}</nav>
        <p className={styles.sidebarNote}>Your rubric and grading mode stay fixed within an assignment. Downloads and deletion are available on every plan.</p>
      </aside>
      <div className={styles.content}>
        {creating ? panel(<form onSubmit={event => { event.preventDefault(); void action(async () => {
          const payload = { title, rubricText: rubric, draftText: draft, mode };
          const serialized = JSON.stringify(payload);
          if (!creation.current || creation.current.payload !== serialized) creation.current = { payload: serialized, id: crypto.randomUUID() };
          setMessage("Saving your assignment…");
          const saved = await api<LabWorkspace>(API, { ...payload, id: creation.current.id });
          applyWorkspace(saved);
          await refreshList();
          setTitle(""); setRubric(""); setDraft(""); creation.current = null;
          await evaluate(saved, payload.draftText);
        }); }}>
          <p className={styles.eyebrow}>STEP 1 · CREATE YOUR WORKSPACE</p><h2>Start with your rubric and first draft</h2>
          <label className={styles.field}>Assignment name<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required disabled={disabled} placeholder="e.g. History essay — sources and argument" /></label>
          <TextInput label="Rubric" value={rubric} onChange={setRubric} disabled={disabled} upload={upload} />
          <TextInput label="First draft" value={draft} onChange={setDraft} disabled={disabled} upload={upload} />
          <label className={styles.field}>Grading mode<select value={mode} disabled={disabled} onChange={event => setMode(event.target.value)}><option value="standard">Standard</option><option value="strict">Strict</option></select></label>
          <p className={styles.hint}>The lab trial includes its own revision evaluations. Your regular evaluation balance is unaffected.</p>
          <button className={styles.primary} disabled={disabled || !title.trim() || !rubric.trim() || !draft.trim()}>{busy ? "Working…" : "Create workspace & evaluate V1"}</button>
        </form>) : workspace && <>
          {panel(<>
            <div className={styles.workspaceTitle}><div><p className={styles.eyebrow}>{workspace.assignment.mode.toUpperCase()} · SAVED RUBRIC</p><h2>{workspace.assignment.title}</h2></div><div className={styles.actions}>
              <button disabled={disabled} onClick={() => { void action(async () => {
                const response = await fetch(API + "?id=" + workspace.assignment.id + "&download=1", { cache: "no-store" });
                if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Download failed."); }
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a"); link.href = url; link.download = "rubricheck-assignment-" + workspace.assignment.id + ".json";
                link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage("Your drafts, rubric, evaluations and checklist have been downloaded.");
              }); }}>Download data</button>
              <button disabled={disabled} onClick={() => setConfirmDelete(!confirmDelete)}>Delete</button>
            </div></div>
            {confirmDelete && <div className={styles.deleteBox}><p>Delete this assignment, all drafts, evaluations and feedback? This cannot be undone.</p><button className={styles.danger} disabled={disabled} onClick={() => { void action(async () => {
              await api(API, { id: workspace.assignment.id }, "DELETE");
              setWorkspace(null); setConfirmDelete(false); setCreating(true); window.history.replaceState(null, "", "/lab/assignments"); await refreshList(); setMessage("Assignment and its saved data deleted.");
            }); }}>Delete assignment permanently</button><button disabled={disabled} onClick={() => setConfirmDelete(false)}>Cancel</button></div>}
            <details className={styles.details}><summary>View saved rubric</summary><pre>{workspace.rubric.raw_text}</pre></details>
            <div role="group" aria-label="Saved versions" className={styles.versions}>{workspace.runs.map(run => <button key={run.id} disabled={disabled} aria-pressed={run.version === selectedVersion} onClick={() => setSelectedVersion(run.version)}>V{run.version}<span>{new Date(run.created_at).toLocaleDateString()}</span></button>)}</div>
          </>)}
          {current && panel(<>
            <p className={styles.eyebrow}>{previous ? "VERSION " + previous.version + " → VERSION " + current.version : "YOUR STARTING POINT"}</p>
            <div className={styles.scoreHeading}><h2>{previous ? "What changed in this draft?" : "V1 evaluation"}</h2><strong>{previous && <span>{range(previous.result.overall_range)} → </span>}{range(current.result.overall_range)}<small> / 100</small></strong></div>
            <p className={styles.hint}>AI-estimated range, not a teacher grade or measured grade improvement. Ranges are not statistical confidence intervals.</p>
            {changedConditions.length > 0 && <p className={styles.warning}>Evaluation conditions changed ({changedConditions.join(", ")}). These results are not directly comparable; no score delta is shown.</p>}
            <p>{current.result.summary}</p>
            <div className={styles.tableWrap}><table><thead><tr><th>Criterion</th>{previous && <th>V{previous.version}</th>}<th>V{current.version}</th>{previous && <th>Estimate change</th>}</tr></thead><tbody>
              {(previous ? compareCriteria(previous, current) : current.result.criteria.map(criterion => ({ criterion, previous: undefined, delta: null }))).map((row, index) => <tr key={index}>
                <th>{row.criterion.name}<small>out of {row.criterion.max_score}</small></th>{previous && <td>{row.previous ? range(row.previous.estimated_range) : "—"}</td>}<td>{range(row.criterion.estimated_range)}</td>{previous && <td>{row.delta === null ? "Not comparable" : (row.delta > 0 ? "+" : "") + row.delta + " pts"}</td>}
              </tr>)}
            </tbody></table></div>
            <div className={styles.feedbackList}>{current.result.criteria.map((criterion, index) => <details key={index}><summary>{criterion.name} · feedback</summary>
              {previous?.result.criteria[index] && <p className={styles.hint}>V{previous.version}: {previous.result.criteria[index].feedback}</p>}
              <p>V{current.version}: {criterion.feedback}</p><p className={styles.hint}>{criterion.rationale}</p>
              {criterion.evidence?.filter(quote => current.draft_text.includes(quote)).map((quote, i) => <blockquote key={i}>{quote}</blockquote>)}
            </details>)}</div>
            <Conditions run={current} />
            <details className={styles.details}><summary>View V{current.version} draft</summary><pre>{current.draft_text}</pre></details>
          </>)}
          {current && panel(<>
            <p className={styles.eyebrow}>YOUR NEXT ACTIONS</p><h2>Revision checklist</h2>
            <p className={styles.hint}>{previous ? "AI task review compares this version with V" + previous.version + ". " : ""}Checking an item records your progress. The next evaluation checks whether the omission was addressed.</p>
            <div className={styles.taskCounts}>{(["resolved", "remaining", "new", "uncertain"] as const).map(status => <span key={status}><strong>{current.tasks.filter(task => task.status === status).length}</strong> {statusLabels[status]}</span>)}</div>
            {!current.tasks.length && <p>No concrete revision tasks were identified. Review the criterion feedback before submitting.</p>}
            <div className={styles.taskList}>{current.tasks.map(task => <TaskCard key={task.task_key} task={task} disabled={disabled} criterion={current.result.criteria[task.criterion_index]?.name ?? "Criterion"} toggle={() => { void action(async () => {
              await api(API + "/task", { id: workspace.assignment.id, runId: current.id, taskKey: task.task_key, done: !task.user_done });
              setWorkspace({ ...workspace, runs: workspace.runs.map(run => run.id !== current.id ? run : { ...run, tasks: run.tasks.map(item => item.task_key === task.task_key ? { ...item, user_done: !item.user_done } : item) }) });
            }); }} />)}</div>
            {previous && current.draft_text !== previous.draft_text && <div className={styles.usefulness}><strong>Did this comparison help you decide what to revise next?</strong><div className={styles.actions}>{[true, false].map(helpful => <button key={String(helpful)} disabled={disabled} onClick={() => { void action(async () => {
              await api(API + "/feedback", { id: workspace.assignment.id, runId: current.id, helpful }); setMessage("Thanks — your feedback is saved.");
            }); }}>{helpful ? "Yes, helpful" : "Not yet"}</button>)}</div></div>}
          </>)}
          {panel(<form onSubmit={event => { event.preventDefault(); void action(async () => evaluate(workspace, revision)); }}>
            <p className={styles.eyebrow}>{workspace.runs.length ? "REVISE · RE-EVALUATE · COMPARE" : "EVALUATE YOUR FIRST DRAFT"}</p>
            <h2>{workspace.runs.length ? "Bring your next draft" : "Your first draft is saved"}</h2>
            <p className={styles.hint}>Paste your revised text or upload a file. The saved rubric and grading mode will be used again.</p>
            {atVersionLimit && <p className={styles.warning}>{plan === "pro" ? "This lab workspace has reached its 50-version limit." : "Your free V1/V2 trial is complete. Your work stays available to review, download and delete. Pro supports more revisions."}</p>}
            <TextInput label="Revision draft" value={revision} onChange={setRevision} disabled={disabled} upload={upload} />
            <button className={styles.primary} disabled={disabled || !revision.trim()}>{busy ? "Working…" : atVersionLimit ? "Check for a saved matching result" : workspace.runs.length ? "Evaluate V" + (workspace.runs.length + 1) + " & compare" : "Evaluate V1"}</button>
            {atVersionLimit && <p className={styles.hint}>Identical input and conditions can still open a saved result. New text requires an available version.</p>}
          </form>)}
        </>}
      </div>
    </div>}
  </main>;
}


