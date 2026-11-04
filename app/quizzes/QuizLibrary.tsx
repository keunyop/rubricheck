"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import type { QuizLibrary as Library, QuizSummary, QuizDetail } from "../../src/lib/quizTypes";
import type { AssignmentWorkspace } from "../../src/lib/assignmentWorkspaceTypes";
import { quizFetch, quizErrorMessage } from "../../src/lib/quizClient";
import { scoreAttempt } from "../../src/lib/quizTypes";
import styles from "./quiz.module.css";

export function QuizLibrary({ data, workspace, assignment, jobId, reload }: { data: Library; workspace: AssignmentWorkspace; assignment: string | null; jobId: string | null; reload: () => Promise<void> }) {
  const { t, href, siteLanguage } = useLanguage();
  const [search, setSearch] = useState(""), [state, setState] = useState("all"), [project, setProject] = useState("all"), [kind, setKind] = useState("all"), [sort, setSort] = useState("created");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [detail, setDetail] = useState<QuizDetail | null>(null);
  const [editing, setEditing] = useState<QuizSummary | null>(null), [title, setTitle] = useState(""), [projectId, setProjectId] = useState("");
  const panel = useRef<HTMLDialogElement>(null), edit = useRef<HTMLDialogElement>(null);
  const selectedJob = data.jobs.find(j => j.id === jobId && (!j.quizId || data.quizzes.some(q => q.id === j.quizId)));
  const quizzes = data.quizzes.filter(q => (!assignment || q.sources.some(s => s.assignmentId === assignment)) && (state === "all" || q.state === state) && (project === "all" || (q.projectId ?? "none") === project) && (kind === "all" || q.sources.some(s => s.kind === kind)) && `${q.title} ${q.sources.map(s => s.name).join(" ")}`.toLocaleLowerCase(siteLanguage).includes(search.toLocaleLowerCase(siteLanguage))).sort((a, b) => sort === "studied" ? b.lastStudied - a.lastStudied : b.createdAt - a.createdAt);
  async function openDetail(id: string) {
    setError(""); setBusy(true);
    try { setDetail(await quizFetch<QuizDetail>("/api/quizzes?id=" + id)); panel.current?.showModal(); }
    catch (error) { setError(quizErrorMessage(error)); } finally { setBusy(false); }
  }
  async function mutate(body: object) {
    setBusy(true); setError("");
    try { await quizFetch("/api/quizzes", body, "PATCH"); edit.current?.close(); await reload(); }
    catch (error) { setError(quizErrorMessage(error)); } finally { setBusy(false); }
  }
  const active = data.jobs.filter(j => j.status !== "completed");
  return <>
    <header className={styles.header}><h1>{t("My quizzes")}</h1><Link className={styles.primary} href={href("/quizzes?view=create")}>{t("Create a quiz")}</Link></header>
    {data.access.pro ? <p className={styles.muted}>{t("Pro · No monthly generation limit")}</p> : <p className={styles.muted}>{t("{count} free questions remaining / 10 total", { count: data.access.remaining })} {data.access.reserved > 0 && t("{count} questions reserved", { count: data.access.reserved })}</p>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
    {selectedJob?.status === "completed" && selectedJob.quizId && <section className={styles.notice} role="status"><h2>{t("{count} questions created", { count: selectedJob.generatedCount })}</h2>{selectedJob.generatedCount < selectedJob.settings.count && <p>{t("Requested {requested}; saved {actual}. Only supported questions were kept.", { requested: selectedJob.settings.count, actual: selectedJob.generatedCount })}</p>}<p>{selectedJob.sources.map(s => `${s.name} (${s.units.join(", ")})`).join(" · ")}</p><div className={styles.actions}><Link className={styles.primary} href={href("/quizzes?id=" + selectedJob.quizId)}>{t("Practice now")}</Link><Link className={styles.link} href={href("/quizzes")}>{t("Later")}</Link></div></section>}
    {active.length > 0 && <div className={styles.list}>{active.map(job => <section className={styles.card} key={job.id}><h3>{job.settings.title}</h3><p role="status" className={styles.muted}>{t(job.status === "queued" ? "Checking materials…" : job.status === "generating" ? "Generating questions…" : job.status === "validating" ? "Checking answers and explanations…" : quizErrorMessage(new Error(job.error ?? "QUIZ_GENERATION_FAILED")))}</p>{job.status === "failed" && <Link className={styles.link} href={href("/quizzes?view=create&retry=" + job.id)}>{t("Try again")}</Link>}</section>)}</div>}
    {data.quizzes.length > 0 && <section className={styles.form} aria-label={t("Search quizzes")}>
      <label className={styles.field}>{t("Search quizzes")}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Quiz title or source name")} /></label>
      <div className={styles.tabs}>{[["all", "All quizzes"], ["unstarted", "Not started"], ["active", "In progress"], ["completed", "Completed"]].map(([value, label]) => <button key={value} aria-pressed={state === value} onClick={() => setState(value)}>{t(label)}</button>)}</div>
      <div className={styles.grid}>
        <label className={styles.field}>{t("Project")}<select value={project} onChange={e => setProject(e.target.value)}><option value="all">{t("All projects")}</option><option value="none">{t("No project")}</option>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className={styles.field}>{t("Source type")}<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">{t("All sources")}</option>{["assignment", "pdf", "pptx", "docx", "txt", "image", "text"].map(k => <option key={k} value={k}>{k === "assignment" ? t("Graded assignment") : k === "image" ? t("Image") : k === "text" ? t("Pasted text") : k.toUpperCase()}</option>)}</select></label>
        <label className={styles.field}>{t("Sort by")}<select value={sort} onChange={e => setSort(e.target.value)}><option value="created">{t("Recently created")}</option><option value="studied">{t("Recently studied")}</option></select></label>
      </div>
      {assignment && <Link className={styles.link} href={href("/quizzes")}>{t("All quizzes")}</Link>}
    </section>}
    {!quizzes.length && <div className={styles.empty}><p>{t(data.quizzes.length ? "No results found." : "No quizzes yet.")}</p>{!data.quizzes.length && <Link className={styles.primary} href={href("/quizzes?view=create")}>{t("Create a quiz")}</Link>}</div>}
    <div className={styles.list}>{quizzes.map(quiz => <article className={styles.card} key={quiz.id}>
      <h2><button disabled={busy} className="text-start" onClick={() => void openDetail(quiz.id)}>{quiz.title}</button></h2>
      <p className={styles.muted}>{quiz.sources.map(s => `${s.name}${s.version ? ` · V${s.version}` : ""}`).join(" · ")}</p>
      <p className={styles.muted}>{t("{count} questions", { count: quiz.questionCount })} · {t("{mcq} multiple choice · {tf} true/false", quiz.types ? { mcq: quiz.types.mcq, tf: quiz.types.true_false } : { mcq: 0, tf: 0 })} · {new Date(quiz.createdAt).toLocaleDateString(siteLanguage)}</p>
      <p className={styles.muted}>{quiz.state === "active" ? t("In progress") + ` · ${quiz.progress}/${quiz.questionCount}` : t(quiz.state === "unstarted" ? "Not started" : "Completed")}{quiz.latestFull && ` · ${t("Latest full attempt")}: ${quiz.latestFull.correct}/${quiz.latestFull.total}`}</p>
      {quiz.sources.some(s => s.expiresAt <= Date.now()) && <p className={styles.muted}>{t("Source expired")}</p>}
      <div className={styles.actions}><Link className={styles.primary} href={href("/quizzes?id=" + quiz.id)}>{t(quiz.state === "active" ? "Continue practice" : quiz.state === "unstarted" ? "Start practice" : "Practice again")}</Link>
        <details><summary>{t("More actions")}</summary><div className={styles.actions}><button className={styles.link} onClick={() => { setEditing(quiz); setTitle(quiz.title); setProjectId(quiz.projectId ?? ""); edit.current?.showModal(); }}>{t("Rename or move")}</button><Link className={styles.link} href={href("/quizzes?view=create&from=" + quiz.id)}>{t("Create new questions")}</Link><button className={styles.link} disabled={busy} onClick={() => { if (window.confirm(t("Delete this quiz and all its attempts? Your assignment and other quizzes will stay."))) void mutate({ action: "delete", quizId: quiz.id }); }}>{t("Delete")}</button></div></details>
      </div>
    </article>)}</div>
    <dialog ref={edit} className={`${styles.dialog} ${styles.page}`} aria-label={t("Rename or move")}><form onSubmit={e => { e.preventDefault(); if (editing) void mutate({ action: "edit", quizId: editing.id, title, projectId: projectId || null }); }} className={styles.form}><h2>{t("Rename or move")}</h2><label className={styles.field}>{t("Quiz title")}<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label><label className={styles.field}>{t("Project")}<select value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">{t("No project")}</option>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{error && <p role="alert">{t(error)}</p>}<div className={styles.actions}><button className={styles.primary} disabled={busy}>{t("Save")}</button><button type="button" className={styles.secondary} onClick={() => edit.current?.close()}>{t("Close")}</button></div></form></dialog>
    <dialog ref={panel} className={`${styles.dialog} ${styles.page}`} aria-label={t("Quiz details")}>
      {detail && <><header className={styles.header}><h2>{detail.quiz.title}</h2><button onClick={() => panel.current?.close()} className={styles.secondary}>{t("Close")}</button></header><p>{new Date(detail.quiz.createdAt).toLocaleString(siteLanguage)}</p><div className={styles.list}>{detail.quiz.sources.map(s => <p key={s.id}>{s.name}{s.version ? ` · V${s.version}` : ""} · {t(s.unitKind)} {s.units.join(", ")}</p>)}</div><h3 className="mt-6">{t("Previous attempts")}</h3>{detail.attempts.map(a => { const score = scoreAttempt(detail.quiz, a); return <p key={a.id} className={styles.muted}>{new Date(a.startedAt).toLocaleString(siteLanguage)} · {t(a.kind === "full" ? "Full attempt" : "Mistake review")} · {a.completedAt ? `${score.correct}/${score.total} (${score.percent}%)` : t("In progress")}</p>; })}<Link className={styles.primary} href={href("/quizzes?id=" + detail.quiz.id)}>{t("Open quiz")}</Link></>}
    </dialog>
  </>;
}
