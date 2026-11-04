"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "../components/LanguageProvider";
import { quizFetch, quizErrorMessage } from "../../src/lib/quizClient";
import type { QuizLibrary as LibraryData } from "../../src/lib/quizTypes";
import type { AssignmentWorkspace } from "../../src/lib/assignmentWorkspaceTypes";
import { QuizLibrary } from "./QuizLibrary";
import { QuizCreator } from "./QuizCreator";
import { QuizStudy } from "./QuizStudy";
import { QuizWorkspace } from "../components/QuizWorkspace";
import styles from "./quiz.module.css";

export function QuizApp({ email }: { email: string }) {
  const { t, preferencesLoading } = useLanguage(), params = useSearchParams();
  const [data, setData] = useState<(LibraryData & { workspace: AssignmentWorkspace }) | null>(null);
  const [error, setError] = useState("");
  const [creatorReset, setCreatorReset] = useState(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    try { const value = await quizFetch<LibraryData & { workspace: AssignmentWorkspace }>("/api/quizzes", undefined, "GET", signal); if (!signal?.aborted) { setData(value); setError(""); } }
    catch (error) { if (!signal?.aborted) setError(quizErrorMessage(error)); }
  }, []);
  const pending = data?.jobs.some(j => !["failed", "completed"].includes(j.status));
  useEffect(() => {
    const controller = new AbortController();
    // Synchronize this screen with the account-owned server records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(controller.signal);
    const timer = pending ? setInterval(() => void reload(controller.signal), 3000) : undefined;
    return () => { controller.abort(); clearInterval(timer); };
  }, [reload, pending, params]);
  const id = params.get("id"), create = params.get("view") === "create";
  return <QuizWorkspace email={email} quizzes={data?.quizzes} access={data?.access} selectedId={id} library={!id && !create} loading={!data && !error} onNewQuiz={params.toString() === "view=create" ? () => setCreatorReset(value => value + 1) : undefined}>
    {error && <div className={styles.error} role="alert">{t(error)} <button onClick={() => void reload()}>{t("Try again")}</button></div>}
    {(!data || create && preferencesLoading) && !error && <p role="status" className={styles.muted}>{t("Loading…")}</p>}
    {data && (id ? <QuizStudy key={id} id={id} projects={data.workspace.projects} /> : create ? !preferencesLoading && <QuizCreator key={params.toString() + ":" + creatorReset} library={data} workspace={data.workspace} assignment={params.get("assignment")} trial={params.get("trial") === "1"} reuse={params.get("from")} retryJob={data.jobs.find(j => j.id === params.get("retry"))} /> : <QuizLibrary data={data} workspace={data.workspace} assignment={params.get("assignment")} jobId={params.get("job")} reload={() => reload()} />)}
  </QuizWorkspace>;
}
