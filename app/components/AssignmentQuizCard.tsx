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
    void Promise.all([quizFetch<QuizLibrary>("/api/quizzes", undefined, "GET", controller.signal), fetch("/api/evaluations/" + evaluationId, { cache: "no-store", signal: controller.signal })]).then(([data, response]) => setState({ owner: email + evaluationId, data, expired: response.status === 404 || response.status === 410 })).catch(() => {});
    return () => controller.abort();
  }, [email, evaluationId]);
  const current = state.owner === email + evaluationId ? state : null;
  const quizzes = current?.data?.quizzes.filter(q => q.sources.some(s => s.assignmentId === evaluationId)) ?? [];
  return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 md:p-5" aria-label={t("Assignment review")}>
    <h3 className="text-sm font-semibold text-slate-900">{t("Assignment review")}</h3>
    {current?.expired && <p className="mt-2 text-sm text-slate-600">{t("Source expired")}</p>}
    <Link className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" href={href("/quizzes?view=create" + (trial ? "&trial=1" : evaluationId && !current?.expired ? "&assignment=" + evaluationId : ""))}>{t(current?.expired ? "Attach source again" : "Create an AI review quiz")}</Link>
    {!email && <p className="mt-2 text-xs text-slate-500">{t("Sign up for 10 free questions in total.")}</p>}
    {quizzes.length > 0 && <details className="mt-3 text-sm"><summary>{t("{count} quizzes from this assignment", { count: quizzes.length })}</summary><ul className="mt-2 space-y-2">{quizzes.slice(0, 3).map(q => <li key={q.id}><Link href={href("/quizzes?id=" + q.id)}>{q.title}</Link></li>)}</ul><Link className="mt-2 inline-block text-indigo-700" href={href("/quizzes?assignment=" + evaluationId)}>{t("View all")}</Link></details>}
  </section>;
}
