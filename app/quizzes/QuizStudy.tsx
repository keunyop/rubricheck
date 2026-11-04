"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { scoreAttempt, type QuizAttempt, type QuizDetail, type QuizQuestion, type QuizSource } from "../../src/lib/quizTypes";
import type { AssignmentProject } from "../../src/lib/assignmentWorkspaceTypes";
import { quizFetch, quizErrorMessage } from "../../src/lib/quizClient";
import styles from "./quiz.module.css";

type Detail = QuizDetail & { linkedAssignmentIds: string[] };
type SaveAction = { questionId?: string; answer?: number; position?: number; finish?: boolean };
export function QuizStudy({ id }: { id: string; projects: AssignmentProject[] }) {
  const { t, href, siteLanguage } = useLanguage();
  const [detail, setDetail] = useState<Detail | null>(null), [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [selection, setSelection] = useState<number | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [unsaved, setUnsaved] = useState(false);
  const [source, setSource] = useState<QuizSource | null>(null), [sourceError, setSourceError] = useState(""), [sourceQuestion, setSourceQuestion] = useState<QuizQuestion | null>(null), [reportStatus, setReportStatus] = useState("");
  const sourcePanel = useRef<HTMLDialogElement>(null), pending = useRef<SaveAction | null>(null), startId = useRef<string | null>(null);
  const quiz = detail?.quiz;
  const questions = quiz && attempt ? attempt.questionIds.map(id => quiz.questions.find(q => q.id === id)!).filter(Boolean) : [];
  const question = questions[attempt?.position ?? 0];
  const confirmed = question && attempt ? attempt.answers[question.id] : undefined;
  const score = quiz && attempt ? scoreAttempt(quiz, attempt) : null;
  const finished = Boolean(attempt?.completedAt);

  useEffect(() => {
    const controller = new AbortController();
    void quizFetch<Detail>("/api/quizzes?id=" + id, undefined, "GET", controller.signal).then(value => { setDetail(value); setAttempt(value.attempts.find(a => a.completedAt === null) ?? value.attempts[0] ?? null); }).catch(error => { if (!controller.signal.aborted) setError(quizErrorMessage(error)); });
    return () => controller.abort();
  }, [id]);

  function applyAttempt(value: QuizAttempt) {
    setAttempt(value); setSelection(null); setUnsaved(false); pending.current = null;
    setDetail(previous => previous ? { ...previous, attempts: [value, ...previous.attempts.filter(a => a.id !== value.id)] } : previous);
  }
  async function start(kind: "full" | "review", restart = false) {
    if (busy) return;
    if (attempt && !attempt.completedAt && restart && !window.confirm(t("Finish the current attempt and start again?"))) return;
    setBusy(true); setError("");
    try {
      startId.current ??= crypto.randomUUID();
      const result = await quizFetch<{ attempt: QuizAttempt }>("/api/quizzes/attempts", { action: "start", id: startId.current, quizId: id, kind, fromAttempt: kind === "review" ? attempt?.id : undefined, restart });
      applyAttempt(result.attempt); startId.current = null;
    } catch (error) { setError(quizErrorMessage(error)); } finally { setBusy(false); }
  }
  async function save(action: SaveAction) {
    if (!attempt || busy) return;
    setBusy(true); setError(""); pending.current = action;
    try {
      const result = await quizFetch<{ attempt: QuizAttempt }>("/api/quizzes/attempts", { action: "answer", quizId: id, id: attempt.id, revision: attempt.revision, ...action });
      applyAttempt(result.attempt);
    } catch (error) {
      // A response may be lost after the write committed. Read the authoritative
      // attempt before offering a retry so confirmed answers never double-submit.
      try {
        const latest = await quizFetch<Detail>("/api/quizzes?id=" + id);
        const stored = latest.attempts.find(a => a.id === attempt.id);
        setDetail(latest);
        if (stored && stored.revision > attempt.revision) { applyAttempt(stored); setError(t("Progress was reloaded from your account.")); }
        else { setUnsaved(true); setError(quizErrorMessage(error)); }
      } catch { setUnsaved(true); setError(quizErrorMessage(error)); }
    } finally { setBusy(false); }
  }
  async function showSource(q: QuizQuestion) {
    setSource(null); setSourceError(""); setSourceQuestion(q); sourcePanel.current?.showModal();
    try { const result = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources?id=" + q.sourceId); setSource(result.source); }
    catch (error) { setSourceError(quizErrorMessage(error)); }
  }
  async function report(q: QuizQuestion, reason: string) {
    setReportStatus("");
    try { await quizFetch("/api/quizzes", { action: "report", quizId: id, questionId: q.id, reason }, "PATCH"); setReportStatus(t("Report saved. Thank you.")); }
    catch (error) { setReportStatus(t(quizErrorMessage(error))); }
  }
  function feedback(q: QuizQuestion, answer: number | undefined) {
    return <div className={styles.feedback}>
      <strong>{t(answer === undefined ? "Unanswered" : answer === q.answer ? "Correct" : "Incorrect")}</strong>
      <p>{t("Correct answer")}: {q.options[q.answer]}</p><p className="mt-2" dir="auto">{q.explanation}</p>
      <div className={styles.actions}><button className={styles.link} onClick={() => void showSource(q)}>{t("View source")}</button><details><summary>{t("Report question")}</summary><div className={styles.actions}>{[["answer", "Wrong answer"], ["ambiguous", "Ambiguous question"], ["source", "Source issue"], ["other", "Other issue"]].map(([reason, label]) => <button className={styles.link} key={reason} onClick={() => void report(q, reason)}>{t(label)}</button>)}</div></details></div>
    </div>;
  }

  return <>
    <header className={styles.header}><h1>{quiz?.title ?? t("Open quiz")}</h1><Link className={styles.link} href={href("/quizzes")}>{t("Exit practice")}</Link></header>
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
    {unsaved && <div className={styles.error} role="alert">{t("Not saved")} <button disabled={busy} onClick={() => pending.current && void save(pending.current)}>{t("Try again")}</button></div>}
    {reportStatus && <p role="status" className={styles.muted}>{reportStatus}</p>}
    {!quiz && !error && <p role="status">{t("Loading…")}</p>}
    {quiz && !attempt && <section className={styles.card}><p>{t("{count} questions", { count: quiz.questions.length })} · {t("{mcq} multiple choice · {tf} true/false", { mcq: quiz.questions.filter(q => q.type === "mcq").length, tf: quiz.questions.filter(q => q.type === "true_false").length })}</p>{quiz.requestedCount > quiz.questions.length && <p>{t("Requested {requested}; saved {actual}. Only supported questions were kept.", { requested: quiz.requestedCount, actual: quiz.questions.length })}</p>}<button className={styles.primary} disabled={busy} onClick={() => void start("full")}>{t("Start practice")}</button></section>}
    {quiz && attempt && question && !finished && <section aria-label={t("Quiz practice")} lang={quiz.settings.language} dir={quiz.settings.language === "ur" ? "rtl" : "ltr"}>
      <div className={styles.row}><p>{t("Question {current} / {total}", { current: attempt.position + 1, total: questions.length })} · {t(attempt.kind === "full" ? "Full attempt" : "Mistake review")}</p><span role="status" className={styles.muted}>{t(busy ? "Saving…" : unsaved ? "Not saved" : "Saved")}</span></div>
      <progress className={styles.progress} value={Object.keys(attempt.answers).length} max={questions.length} aria-label={t("Practice progress")} />
      <p className={`${styles.muted} mt-5`}>{t(question.type === "mcq" ? "Multiple choice" : "True / False")}</p>
      <fieldset key={question.id} disabled={busy || unsaved || confirmed !== undefined}>
        <legend className={styles.question}>{question.question}</legend>
        <div className={styles.options}>{question.options.map((option, index) => <label className={styles.option} key={index}><input type="radio" name={question.id} value={index} checked={(confirmed ?? selection) === index} onChange={() => setSelection(index)} /><span>{question.type === "mcq" ? `${String.fromCharCode(65 + index)}. ` : ""}{question.type === "true_false" ? `${option} · ${t(index === 0 ? "True" : "False")}` : option}</span></label>)}</div>
      </fieldset>
      <div aria-live="polite">{confirmed !== undefined && feedback(question, confirmed)}</div>
      <div className={styles.footer}><button className={styles.secondary} disabled={busy || unsaved} onClick={() => void save({ position: (attempt.position + 1) % questions.length })}>{t(confirmed === undefined ? "Skip" : "Next question")}</button>{confirmed === undefined ? <button className={styles.primary} disabled={selection === null || busy || unsaved} onClick={() => void save({ questionId: question.id, answer: selection! })}>{t("Check answer")}</button> : attempt.position === questions.length - 1 ? <button className={styles.primary} disabled={busy || unsaved} onClick={() => { if (!score?.unanswered || window.confirm(t("Finish with {count} unanswered questions?", { count: score.unanswered }))) void save({ finish: true }); }}>{t("View study results")}</button> : <button className={styles.primary} disabled={busy || unsaved} onClick={() => void save({ position: attempt.position + 1 })}>{t("Next question")}</button>}</div>
      <details className="mt-6"><summary>{t("{count} unanswered questions", { count: score?.unanswered ?? 0 })}</summary><div className={styles.actions}>{questions.map((q, index) => attempt.answers[q.id] === undefined && <button key={q.id} className={styles.secondary} disabled={busy || unsaved} onClick={() => void save({ position: index })}>{index + 1}</button>)}</div><button className={styles.link} disabled={busy || unsaved} onClick={() => { if (window.confirm(t("Finish with {count} unanswered questions?", { count: score?.unanswered ?? 0 }))) void save({ finish: true }); }}>{t("View study results")}</button></details>
      <button className={`${styles.link} mt-6`} disabled={busy || unsaved} onClick={() => void start("full", true)}>{t("Start a new attempt")}</button>
    </section>}
    {quiz && attempt && finished && score && <>
      <section className={styles.card}><h2>{t("Review complete")}</h2><p>{t(attempt.kind === "full" ? "Full attempt" : "Mistake review")} · {score.correct}/{score.total} · {score.percent}%</p><p>{t("{wrong} incorrect · {unanswered} unanswered", { wrong: score.wrong, unanswered: score.unanswered })}</p>
        <p>{t("Correct concepts")}: {[...new Set(questions.filter(q => attempt.answers[q.id] === q.answer).flatMap(q => q.concepts))].join(" / ") || "—"}</p>
        <p>{t("Concepts to revisit")}: {[...new Set(questions.filter(q => attempt.answers[q.id] !== q.answer).flatMap(q => q.concepts))].join(" / ") || "—"}</p>
        <div className={styles.actions}>{score.correct < score.total && <button className={styles.primary} disabled={busy} onClick={() => void start("review")}>{t("Review mistakes and unanswered questions")}</button>}<button className={score.correct === score.total ? styles.primary : styles.secondary} disabled={busy} onClick={() => void start("full")}>{t("Practice all again")}</button></div>
      </section>
      <div className={styles.list}>{questions.map((q, i) => <details key={q.id} className={styles.card}><summary><bdi>{i + 1}. {q.question}</bdi> · {t(attempt.answers[q.id] === undefined ? "Unanswered" : attempt.answers[q.id] === q.answer ? "Correct" : "Incorrect")}</summary>{feedback(q, attempt.answers[q.id])}</details>)}</div>
      <section className={styles.section}><h2>{t("Previous attempts")}</h2>{detail!.attempts.map(a => { const result = scoreAttempt(quiz, a); return <button key={a.id} className={styles.secondary} onClick={() => { setAttempt(a); setSelection(null); }}>{new Date(a.startedAt).toLocaleString(siteLanguage)} · {t(a.kind === "full" ? "Full attempt" : "Mistake review")} · {a.completedAt ? `${result.correct}/${result.total} (${result.percent}%)` : t("Continue practice")}</button>; })}</section>
      <div className={styles.footer}><Link className={styles.link} href={href("/quizzes?view=create&from=" + id)}>{t("Create new questions")}</Link>{detail!.linkedAssignmentIds?.[0] && <Link className={styles.link} href={href("/workspace?evaluation_id=" + detail!.linkedAssignmentIds[0])}>{t("Assignment result")}</Link>}<Link className={styles.secondary} href={href("/quizzes")}>{t("My quizzes")}</Link></div>
    </>}
    <dialog ref={sourcePanel} className={`${styles.dialog} ${styles.page}`} aria-label={t("View source")}><header className={styles.header}><h2>{quiz?.sources.find(s => s.id === sourceQuestion?.sourceId)?.name}</h2><button className={styles.secondary} onClick={() => sourcePanel.current?.close()}>{t("Close")}</button></header><p>{t(quiz?.sources.find(s => s.id === sourceQuestion?.sourceId)?.unitKind ?? "paragraph")} {sourceQuestion?.unit}</p>{sourceError ? <p role="status" className={styles.muted}>{t(sourceError)}</p> : source ? <p dir="auto" className={styles.sourceText}>{source.segments.find(s => s.unit === sourceQuestion?.unit)?.text}</p> : <p role="status">{t("Loading…")}</p>}</dialog>
  </>;
}
