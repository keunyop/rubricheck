"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { AdminQuizDetail, AdminQuizList } from "../../src/lib/adminQuizLibrary";
import type { AdminQuizMetrics } from "../../src/lib/adminQuizMetrics";

const PAGE_SIZE = 20;

function formatDate(value: number | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export function QuizActivity() {
  const [data, setData] = useState<AdminQuizMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const [quizList, setQuizList] = useState<AdminQuizList | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<AdminQuizDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const listRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/quizzes" + (refresh ? "?refresh=1" : ""), { cache: "no-store", signal: controller.signal });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || "Unable to load quiz activity. Please retry.");
      if (!value.totals || !value.generation || !["complete", "partial"].includes(value.coverage)) throw new Error("Unable to load quiz activity. Please retry.");
      if (!controller.signal.aborted) setData(value);
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load quiz activity. Please retry.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setListLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams({ view: "list", q: listQuery, offset: String(offset), limit: String(PAGE_SIZE) });
      const response = await fetch(`/api/admin/quizzes?${params}`, { cache: "no-store", signal: controller.signal });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || "Unable to load saved quizzes.");
      const normalized: AdminQuizList = {
        generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
        coverage: value.coverage === "partial" ? "partial" : "complete",
        scannedAccounts: Number(value.scannedAccounts) || 0,
        scannedQuizzes: Number(value.scannedQuizzes) || 0,
        total: Number(value.total) || 0,
        offset: Number(value.offset) || 0,
        limit: Number(value.limit) || PAGE_SIZE,
        items: Array.isArray(value.items) ? value.items : [],
      };
      if (!controller.signal.aborted) setQuizList(normalized);
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setQuizList(null);
        setListError(loadError instanceof Error ? loadError.message : "Unable to load saved quizzes.");
      }
    } finally {
      if (!controller.signal.aborted) setListLoading(false);
    }
  }, [listQuery, offset]);

  const openQuiz = useCallback(async (ownerId: string, id: string) => {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ view: "detail", owner: ownerId, id });
      const response = await fetch(`/api/admin/quizzes?${params}`, { cache: "no-store", signal: controller.signal });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || "Unable to load this quiz.");
      if (!Array.isArray(value.questions)) throw new Error("Unable to load this quiz.");
      if (!controller.signal.aborted) setDetail(value);
    } catch (loadError) {
      if (!controller.signal.aborted) setDetailError(loadError instanceof Error ? loadError.message : "Unable to load this quiz.");
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  useEffect(() => {
    void loadList();
    return () => listRequest.current?.abort();
  }, [loadList]);

  useEffect(() => () => detailRequest.current?.abort(), []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDetail(null);
    setOffset(0);
    setListQuery(search.trim());
  }

  const count = (value: number) => (data?.coverage === "partial" ? "≥ " : "") + value.toLocaleString();
  const pageEnd = quizList ? Math.min(quizList.offset + quizList.items.length, quizList.total) : 0;

  return <section aria-labelledby="quiz-activity-title" aria-busy={loading || listLoading} className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="quiz-activity-title" className="text-lg font-semibold text-slate-900">Quiz activity</h2><p className="mt-1 text-sm text-slate-500">Review saved quizzes and their generated questions. Deleted quizzes and practice sessions are excluded.</p></div>
      <button type="button" onClick={() => void load(true)} disabled={loading} className="min-h-10 rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50">{loading ? "Refreshing..." : "Refresh quizzes"}</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && !data && <p role="status" className="py-6 text-sm text-slate-500">Loading quiz activity...</p>}
    {data && <>
      {data.coverage === "partial" && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Partial snapshot. Counts are minimums from {data.scannedAccounts.toLocaleString()} scanned accounts.</p>}
      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Quiz users", data.totals.users], ["Saved quizzes", data.totals.quizzes], ["Questions", data.totals.questions], ["Practice sessions", data.totals.attempts]].map(([label, value]) => <div key={label} className="rounded-xl bg-teal-50/70 p-4"><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="mt-2 text-2xl font-semibold text-teal-900">{count(Number(value))}</dd></div>)}</dl>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">{[["Completed sessions", data.totals.completedAttempts], ["Review sessions", data.totals.reviewAttempts], ["Completed generations", data.generation.completed], ["In progress", data.generation.inProgress], ["Failed", data.generation.failed], ["Interrupted", data.generation.interrupted]].map(([label, value]) => <div key={label} className="flex gap-2"><dt>{label}</dt><dd className="font-semibold text-slate-900">{count(Number(value))}</dd></div>)}</dl>
      <p className="mt-4 text-xs text-slate-500">Updated <time dateTime={data.generatedAt}>{formatDate(data.generatedAt)}</time></p>
    </>}

    <div className="my-6 border-t border-slate-200" />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h3 className="font-semibold text-slate-900">Quiz library</h3><p className="mt-1 text-sm text-slate-500">Select a saved quiz to inspect every question, answer, and explanation.</p></div>
      <form onSubmit={submitSearch} className="flex w-full max-w-md gap-2">
        <label className="sr-only" htmlFor="admin-quiz-search">Search saved quizzes</label>
        <input id="admin-quiz-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Title or source name" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
        <button type="submit" className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Search</button>
      </form>
    </div>
    {listError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{listError}</p>}
    {listLoading && <p role="status" className="py-6 text-sm text-slate-500">Loading saved quizzes...</p>}
    {!listLoading && quizList && <>
      {quizList.coverage === "partial" && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This is a partial storage snapshot. Refine the search if the quiz you need is not shown.</p>}
      {quizList.items.length === 0 ? <p className="py-6 text-sm text-slate-500">{listQuery ? "No saved quizzes match this search." : "No saved quizzes found."}</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Questions</th><th className="px-4 py-3">Settings</th><th className="px-4 py-3"><span className="sr-only">Action</span></th></tr></thead>
          <tbody className="divide-y divide-slate-200">{quizList.items.map(quiz => <tr key={`${quiz.ownerId}:${quiz.id}`} className="align-top"><td className="px-4 py-3"><p className="font-medium text-slate-900">{quiz.title}</p><p className="mt-1 max-w-sm truncate text-xs text-slate-500" title={quiz.sourceNames.join(" · ")}>{quiz.sourceNames.join(" · ") || "No source name"}</p></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(quiz.createdAt)}</td><td className="px-4 py-3 text-slate-600">{quiz.questionCount.toLocaleString()}</td><td className="px-4 py-3 text-slate-600">{quiz.language} · {quiz.difficulty} · {quiz.purpose}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => void openQuiz(quiz.ownerId, quiz.id)} className="min-h-9 whitespace-nowrap rounded-lg border border-teal-200 px-3 font-semibold text-teal-800 hover:bg-teal-50">View quiz</button></td></tr>)}</tbody>
        </table>
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><p>{quizList.total ? `${quizList.offset + 1}–${pageEnd} of ${quizList.total}` : "0 quizzes"}</p><div className="flex gap-2"><button type="button" disabled={quizList.offset === 0} onClick={() => { setDetail(null); setOffset(current => Math.max(0, current - PAGE_SIZE)); }} className="min-h-9 rounded-lg border border-slate-300 px-3 font-medium disabled:opacity-40">Previous</button><button type="button" disabled={pageEnd >= quizList.total} onClick={() => { setDetail(null); setOffset(current => current + PAGE_SIZE); }} className="min-h-9 rounded-lg border border-slate-300 px-3 font-medium disabled:opacity-40">Next</button></div></div>
    </>}

    {(detailLoading || detailError || detail) && <section aria-labelledby="quiz-detail-title" className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/30 p-4 sm:p-5">
      {detailLoading && <p role="status" className="text-sm text-slate-600">Loading quiz questions...</p>}
      {detailError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{detailError}</p>}
      {detail && <><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="quiz-detail-title" className="text-lg font-semibold text-slate-900">{detail.title}</h3><p className="mt-1 text-sm text-slate-500">Created {formatDate(detail.createdAt)} · {detail.questionCount} questions</p></div><button type="button" onClick={() => setDetail(null)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Close</button></div>
        {detail.topic && <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Topic:</span> {detail.topic}</p>}
        <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-700">Sources:</span> {detail.sources.map(source => source.name).join(" · ") || "No source name"}</p>
        <ol className="mt-5 space-y-4">{detail.questions.map((question, index) => <li key={question.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-semibold text-slate-900">{index + 1}. {question.question}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-600">{question.type.replace("_", " ")}</span></div><ol className="mt-3 grid gap-2">{question.options.map((option, optionIndex) => <li key={`${question.id}:${optionIndex}`} className={`rounded-lg border px-3 py-2 text-sm ${optionIndex === question.answer ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-900" : "border-slate-200 text-slate-700"}`}>{String.fromCharCode(65 + optionIndex)}. {option}{optionIndex === question.answer ? " — Correct" : ""}</li>)}</ol><p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Explanation:</span> {question.explanation}</p><p className="mt-2 text-xs text-slate-500">{question.sourceName} · unit {question.unit}{question.concepts?.length ? ` · ${question.concepts.join(", ")}` : ""}</p></li>)}</ol>
      </>}
    </section>}
  </section>;
}
