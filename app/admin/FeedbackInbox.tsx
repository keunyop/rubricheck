"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FEEDBACK_CATEGORIES, type FeedbackPage, type ProductFeedback } from "../../src/lib/productFeedbackTypes";

export function FeedbackInbox() {
  const [items, setItems] = useState<ProductFeedback[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const retryOffset = useRef(0);

  const load = useCallback(async (offset = 0) => {
    if (pending.current) return;
    pending.current = true; retryOffset.current = offset; setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/feedback?offset=" + offset, { cache: "no-store" });
      const data: FeedbackPage & { message?: string } = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load feedback.");
      setItems(previous => offset === 0 ? data.items : [...previous, ...data.items.filter(item => !previous.some(existing => existing.id === item.id))]);
      setNextOffset(data.nextOffset); setLoaded(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load feedback.");
    } finally { pending.current = false; setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section aria-labelledby="feedback-inbox-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="feedback-inbox-title" className="text-lg font-semibold text-slate-900">Feedback inbox</h2><p className="mt-1 text-sm text-slate-600">Messages from users, newest first.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Refresh feedback</button>
    </div>
    {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="font-semibold underline" disabled={loading} onClick={() => void load(retryOffset.current)}>Try again</button></div>}
    {loaded && !items.length && !loading && !error && <p className="py-10 text-center text-sm text-slate-500">No feedback yet. New messages will appear here.</p>}
    <div className="mt-4 space-y-3">
      {items.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{FEEDBACK_CATEGORIES[item.category]}</span>
          <time dateTime={item.createdAt} className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.message}</p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="min-w-0"><dt className="font-medium text-slate-600">Account</dt><dd className="mt-1 break-all">{item.accountEmail ?? "Guest"}</dd></div>
          <div className="min-w-0"><dt className="font-medium text-slate-600">Reply email</dt><dd className="mt-1 break-all">{item.replyEmail ?? "Not provided"}</dd></div>
          <div><dt className="font-medium text-slate-600">Page</dt><dd className="mt-1">{item.page}</dd></div>
        </dl>
      </article>)}
    </div>
    {loading && <p role="status" className="py-5 text-center text-sm text-slate-500">Loading feedback...</p>}
    {nextOffset !== null && <div className="mt-4 text-center"><button type="button" disabled={loading} onClick={() => void load(nextOffset)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Load older feedback</button></div>}
  </section>;
}
