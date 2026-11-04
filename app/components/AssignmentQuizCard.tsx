"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { quizFetch } from "../../src/lib/quizClient";
import type { QuizLibrary } from "../../src/lib/quizTypes";

export function AssignmentQuizCard({ evaluationId, email, trial = false }: { evaluationId?: string; email: string; trial?: boolean }) {
  const { t, href } = useLanguage();
  const [state, setState] = useState<{ owner: string; data: QuizLibrary | null; expired: boolean }>({ owner: "", data: null, expired: false });
  useEffect(() => {
    if (!email || !evaluationId) return;
    const controller = new AbortController();
    void Promise.all([quizFetch<QuizLibrary>("/api/quizzes", undefined, "GET", controller.signal), fetch("/api/evaluations/" + evaluationId, { cache: "no-store", signal: controller.signal })]).then(([data, response]) => { if (!controller.signal.aborted) setState({ owner: email + evaluationId, data, expired: response.status === 404 || response.status === 410 }); }).catch(() => {});
    return () => controller.abort();
  }, [email, evaluationId]);
  const current = state.owner === email + evaluationId ? state : null;
  const quizzes = current?.data?.quizzes.filter(q => q.sources.some(s => s.assignmentId === evaluationId)) ?? [];
  return <div className="flex max-w-full flex-col items-start gap-2 sm:ms-auto sm:items-end" aria-label={t("Assignment review")}>
    <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition-colors hover:border-teal-300 hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" title={current?.expired ? t("Source expired") : undefined} href={href("/quizzes?view=create" + (trial ? "&trial=1" : evaluationId && !current?.expired ? "&assignment=" + evaluationId : ""))}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      {t(current?.expired ? "Attach source again" : "Create a review Quiz")}
    </Link>
    {quizzes.length > 0 && <details className="max-w-full text-xs text-teal-800"><summary className="cursor-pointer">{t("{count} quizzes from this assignment", { count: quizzes.length })}</summary><ul className="mt-2 space-y-2">{quizzes.slice(0, 3).map(q => <li key={q.id}><Link className="break-words hover:underline" href={href("/quizzes?id=" + q.id)}>{q.title}</Link></li>)}</ul><Link className="mt-2 inline-block font-semibold hover:underline" href={href("/quizzes?assignment=" + evaluationId)}>{t("View all")}</Link></details>}
  </div>;
}
