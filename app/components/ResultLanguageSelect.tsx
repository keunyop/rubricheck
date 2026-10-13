"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LANGUAGE_NAMES, LOCALES, type Locale } from "../../src/i18n/config";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import styles from "./language.module.css";

export function useResultTranslation<T extends { language?: Locale }>(original: T | null, evaluationId?: string) {
  const { signedInEmail } = useAccountSummary();
  const [view, setView] = useState<{ source: T; result: T; owner: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const latest = useRef({ original, signedInEmail });
  latest.current = { original, signedInEmail };
  const cache = useRef(new Map<Locale, T>());
  useEffect(() => {
    request.current?.abort(); cache.current.clear(); setView(null); setBusy(false); setError("");
    return () => request.current?.abort();
  }, [original, signedInEmail]);
  const result = view?.source === original && view.owner === signedInEmail ? view.result : original;
  async function change(language: Locale | "original") {
    if (!original) return;
    request.current?.abort();
    setError("");
    if (language === "original" || original.language === language) { setView(null); setBusy(false); return; }
    const cached = cache.current.get(language);
    if (cached) { setView({ source: original, result: cached, owner: signedInEmail }); setBusy(false); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try {
      const response = await fetch("/api/evaluations/translate", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ ...(evaluationId ? { evaluationId } : {}), language }) });
      const data = await response.json();
      if (!response.ok || !data.result) throw new Error(data.error?.message ?? data.message ?? "Could not translate this result. Your original result is unchanged. Try again.");
      if (controller.signal.aborted || latest.current.original !== original || latest.current.signedInEmail !== signedInEmail) return;
      cache.current.set(language, data.result);
      setView({ source: original, result: data.result, owner: signedInEmail });
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Translation failed. Try again."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return { result, busy, error, change };
}

export function ResultLanguageSelect({ language, busy, error, onChange, unavailable = false }: {
  language?: Locale; busy: boolean; error: string; onChange: (locale: Locale | "original") => void; unavailable?: boolean;
}) {
  const { t } = useLanguage();
  const id = useId();
  return <div className={styles.result} data-html2canvas-ignore="true">
    <label htmlFor={id}>{t("Result language")}</label>
    <select id={id} value={language ?? "original"} disabled={busy || unavailable} aria-describedby={busy || unavailable ? id + "-help" : undefined} aria-busy={busy} onChange={event => onChange(event.target.value as Locale | "original")}>
      <option value="original">{t("Original result")}</option>
      {LOCALES.map(locale => <option key={locale} value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>)}
    </select>
    {(busy || unavailable) && <p id={id + "-help"} className={styles.help} role="status">{t(busy ? "Translating…" : "Save this result to translate it later.")}</p>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
  </div>;
}
