"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LANGUAGE_NAMES, LOCALES, type LanguagePreferences, type Locale } from "../../src/i18n/config";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import styles from "./language.module.css";

export function LanguageSettings() {
  const { t, siteLanguage, resultLanguage, savePreferences, preferencesLoading, preferencesError, retryPreferences } = useLanguage();
  const { signedInEmail } = useAccountSummary();
  const [site, setSite] = useState(siteLanguage);
  const [result, setResult] = useState(resultLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const owner = useRef(signedInEmail);
  owner.current = signedInEmail;
  const id = useId();
  useEffect(() => { setSite(siteLanguage); setResult(resultLanguage); setError(""); }, [siteLanguage, resultLanguage, signedInEmail]);
  async function change(updates: Partial<LanguagePreferences>) {
    const preferences = { siteLanguage: site, resultLanguage: result, ...updates };
    if (pending.current || preferencesLoading || (preferences.siteLanguage === siteLanguage && preferences.resultLanguage === resultLanguage)) return;
    const email = signedInEmail;
    pending.current = true;
    setSaving(true); setError("");
    setSite(preferences.siteLanguage); setResult(preferences.resultLanguage);
    try { await savePreferences(updates); }
    catch {
      if (owner.current === email) {
        setSite(siteLanguage); setResult(resultLanguage);
        setError("Could not save language preferences. Try again.");
      }
    } finally { pending.current = false; setSaving(false); }
  }
  return <div className={styles.settings} aria-busy={saving || preferencesLoading}>
    <label htmlFor={id + "-site"}>{t("Site language")}</label>
    <select id={id + "-site"} value={site} disabled={saving || preferencesLoading} onChange={event => void change({ siteLanguage: event.target.value as Locale })}>
      {LOCALES.map(locale => <option key={locale} value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>)}
    </select>
    <label htmlFor={id + "-result"}>{t("Grading result language")}</label>
    <select id={id + "-result"} value={result} disabled={saving || preferencesLoading} onChange={event => void change({ resultLanguage: event.target.value as Locale })}>
      {LOCALES.map(locale => <option key={locale} value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>)}
    </select>
    {preferencesError && <p className={styles.error} role="alert">{t(preferencesError)} <button type="button" onClick={retryPreferences}>{t("Try again")}</button></p>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
  </div>;
}
