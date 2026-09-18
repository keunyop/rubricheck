"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { FEEDBACK_CATEGORIES, MAX_FEEDBACK_LENGTH, type FeedbackCategory } from "../../src/lib/productFeedbackTypes";
import styles from "./feedback.module.css";

export function FeedbackButton({ email = "" }: { email?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const id = useId();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setSent(false); setError(""); setReplyEmail(email);
    dialog.current?.showModal();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !message.trim()) return;
    pending.current = true; setSending(true); setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim(), replyEmail: replyEmail.trim(), page: window.location.pathname }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.message || "Your feedback could not be sent. Please try again.");
      setSent(true); setMessage("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Your feedback could not be sent. Please try again.");
    } finally { pending.current = false; setSending(false); }
  }

  return <>
    <button type="button" className="cursor-pointer font-medium text-slate-600 transition hover:text-slate-900" aria-haspopup="dialog" onClick={open}>Feedback</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={id + "-title"} aria-describedby={id + "-description"}
      onCancel={event => { if (pending.current) event.preventDefault(); }}
      onClick={event => { if (event.target === event.currentTarget && !pending.current) dialog.current?.close(); }}>
      <div className={styles.body}>
        <div className={styles.heading}>
          <h2 id={id + "-title"}>{sent ? "Thanks for your feedback" : "Share your feedback"}</h2>
          <button type="button" className={styles.close} aria-label="Close feedback" disabled={sending} onClick={() => dialog.current?.close()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <p id={id + "-description"} className={styles.description}>{sent ? "Your message has been sent to the RubriCheck team." : "Tell us what worked, what went wrong, or what you would like to see next."}</p>
        {sent ? <div className={styles.actions}><p className="sr-only" role="status">Feedback sent successfully.</p><button type="button" className={styles.primary} onClick={() => dialog.current?.close()}>Done</button></div> :
          <form onSubmit={submit}>
            <fieldset disabled={sending} className={styles.fields}>
              <label className={styles.label} htmlFor={id + "-category"}>What is your feedback about?</label>
              <select id={id + "-category"} className={styles.input} value={category} onChange={event => setCategory(event.target.value as FeedbackCategory)}>
                {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label className={styles.label} htmlFor={id + "-message"}>Your feedback</label>
              <textarea id={id + "-message"} className={styles.input} autoFocus required rows={5} maxLength={MAX_FEEDBACK_LENGTH} placeholder="Share a little detail so we can help..." value={message} onChange={event => setMessage(event.target.value)} aria-describedby={id + "-count"} />
              <p id={id + "-count"} className={styles.hint}>{message.length.toLocaleString()} / 5,000</p>
              <label className={styles.label} htmlFor={id + "-email"}>Email <span>(optional)</span></label>
              <input id={id + "-email"} className={styles.input} type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={replyEmail} onChange={event => setReplyEmail(event.target.value)} aria-describedby={id + "-email-hint"} />
              <p id={id + "-email-hint"} className={styles.hint}>Leave an email if you would like us to follow up.</p>
            </fieldset>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={sending} onClick={() => dialog.current?.close()}>Cancel</button>
              <button className={styles.primary} disabled={sending || !message.trim()}>{sending ? "Sending..." : "Send feedback"}</button>
            </div>
          </form>}
      </div>
    </dialog>
  </>;
}
