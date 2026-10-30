"use client";

import { type FormEvent, useRef, useState } from "react";
import { MAX_REPLY_LENGTH, MAX_REPLY_SUBJECT_LENGTH, type FeedbackInboxItem, type FeedbackMailSettings, type FeedbackReply } from "../../src/lib/productFeedbackTypes";

const buttonClass = "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const defaultSubject = "Update on your RubriCheck feedback";
const statusLabels = { pending: "Processing / unconfirmed", sent: "Sent", failed: "Not accepted", unknown: "Delivery unconfirmed" };

export function FeedbackReplyPanel({ item, mailSettings, onReply }: {
  item: FeedbackInboxItem;
  mailSettings: FeedbackMailSettings | null;
  onReply: (reply: FeedbackReply) => void;
}) {
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const recipient = item.replyEmail || item.accountEmail;
  const replies = item.replies ?? [];
  const unresolved = replies.some(reply => reply.status === "pending" || reply.status === "unknown");

  async function send(content: { subject: string; message: string }) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/feedback/" + encodeURIComponent(item.id) + "/reply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content),
      });
      const data: { reply?: FeedbackReply; details?: { reply?: FeedbackReply }; code?: string; message?: string } = await response.json();
      if (!response.ok) {
        if (data.details?.reply) onReply(data.details.reply);
        setUncertain(data.code !== "FEEDBACK_EMAIL_REJECTED" && data.code !== "FEEDBACK_MAIL_NOT_CONFIGURED" && response.status >= 409);
        if (data.details?.reply?.status === "unknown") setComposing(false);
        throw new Error(data.message || "Unable to confirm the reply. Retry the same reply to avoid a duplicate email.");
      }
      if (!data.reply) { setUncertain(true); throw new Error("Unable to confirm the reply. Retry the same reply to avoid a duplicate email."); }
      onReply(data.reply); setComposing(false); setMessage(""); setSubject(defaultSubject); setUncertain(false);
      setNotice("Reply sent. The email provider accepted it for delivery.");
    } catch (error) {
      if (error instanceof TypeError || error instanceof SyntaxError) setUncertain(true);
      setError(error instanceof Error ? error.message : "Unable to confirm the reply. Retry the same reply to avoid a duplicate email.");
    } finally { pending.current = false; setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({ subject: subject.trim(), message: message.trim() });
  }

  return <div className="mt-4 border-t border-slate-100 pt-4">
    {notice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {replies.length > 0 && <div className="mb-4 space-y-3" aria-label="Reply history">
      <h3 className="text-sm font-semibold text-slate-800">Reply history</h3>
      {replies.map(reply => <details key={reply.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer break-words text-sm text-slate-700">
          <span className={reply.status === "sent" ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>{statusLabels[reply.status]}</span>
          {" — "}{reply.subject}{" · "}<time dateTime={reply.sentAt ?? reply.createdAt}>{new Date(reply.sentAt ?? reply.createdAt).toLocaleString()}</time>
        </summary>
        <dl className="mt-3 space-y-1 break-all text-xs text-slate-600">
          <div><dt className="inline font-medium">From: </dt><dd className="inline">{reply.from}</dd></div>
          <div><dt className="inline font-medium">To: </dt><dd className="inline">{reply.to}</dd></div>
          <div><dt className="inline font-medium">Reply-to: </dt><dd className="inline">{reply.replyTo}</dd></div>
          <div><dt className="inline font-medium">Sent by: </dt><dd className="inline">{reply.sentBy}</dd></div>
          {reply.providerEmailId && <div><dt className="inline font-medium">Email ID: </dt><dd className="inline">{reply.providerEmailId}</dd></div>}
        </dl>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{reply.message}</p>
        {reply.status !== "sent" && <div className="mt-3 space-y-2 text-xs text-slate-600">
          {(reply.status === "pending" || reply.status === "unknown") && <p>Check this reply before writing another one. A retry uses the same email request. After 23 hours, check the result in Resend.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass} disabled={busy || !mailSettings?.ready} onClick={() => void send({ subject: reply.subject, message: reply.message })}>Retry same reply</button>
            <a href="https://resend.com/emails" target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-700 underline">Check Resend</a>
          </div>
        </div>}
      </details>)}
    </div>}
    {!recipient ? <p className="text-xs text-slate-500">No email address was provided, so this feedback cannot receive an email reply.</p>
      : composing ? <form onSubmit={submit} className="space-y-3 rounded-2xl bg-slate-50 p-4" aria-label="Write a feedback reply" aria-busy={busy}>
        <dl className="space-y-1 break-all text-xs text-slate-600">
          <div><dt className="inline font-medium">To: </dt><dd className="inline">{recipient}{!item.replyEmail && " (account email)"}</dd></div>
          <div><dt className="inline font-medium">From: </dt><dd className="inline">{mailSettings?.from}</dd></div>
          <div><dt className="inline font-medium">Customer replies go to: </dt><dd className="inline">{mailSettings?.replyTo}</dd></div>
        </dl>
        <div><label htmlFor={"reply-subject-" + item.id} className="block text-sm font-medium text-slate-700">Subject</label>
          <input id={"reply-subject-" + item.id} value={subject} onChange={event => setSubject(event.target.value)} required maxLength={MAX_REPLY_SUBJECT_LENGTH} readOnly={busy || uncertain || unresolved} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></div>
        <div><label htmlFor={"reply-message-" + item.id} className="block text-sm font-medium text-slate-700">Reply message</label>
          <textarea id={"reply-message-" + item.id} value={message} onChange={event => setMessage(event.target.value)} required maxLength={MAX_REPLY_LENGTH} rows={7} readOnly={busy || uncertain || unresolved} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          <p className="mt-1 text-xs text-slate-500">{message.length.toLocaleString()} / {MAX_REPLY_LENGTH.toLocaleString()} characters. The message will be sent as plain text.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !mailSettings?.ready || !subject.trim() || !message.trim()} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Sending..." : uncertain || unresolved ? "Retry same reply" : "Send reply"}</button>
          <button type="button" disabled={busy} onClick={() => setComposing(false)} className={buttonClass}>Close draft</button>
        </div>
      </form>
        : <button type="button" className={buttonClass} disabled={busy || !mailSettings?.ready || unresolved} onClick={() => { setComposing(true); setNotice(""); }}>{uncertain ? "Reopen reply" : "Reply"}</button>}
  </div>;
}
