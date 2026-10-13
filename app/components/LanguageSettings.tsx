"use client";

import { useEffect, useId, useState } from "react";
import { LANGUAGE_NAMES, LOCALES, type Locale } from "../../src/i18n/config";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import styles from "./language.module.css";

export function LanguageSettings() {
  const { t, siteLanguage, resultLanguage, savePreferences, preferencesLoading, preferencesError, retryPreferences } = useLanguage();
  const { signedInEmail } = useAccountSummary();
  const [site, setSite] = useState(siteLanguage);
  const [result, setResult] = useState(resultLanguage);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => { setSite(siteLanguage); setResult(resultLanguage); }, [siteLanguage, resultLanguage]);
  useEffect(() => { setStatus(""); setError(""); }, [signedInEmail]);
  const changed = site !== siteLanguage || result !== resultLanguage;
  return <form className={styles.settings} onSubmit={async event => {
    event.preventDefault(); if (saving || preferencesLoading) return;
    setSaving(true); setError(""); setStatus("");
    try { await savePreferences({ siteLanguage: site, resultLanguage: result }); setStatus(signedInEmail ? "Language preferences saved." : "Language changed for this browser."); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save language preferences. Try again."); }
    finally { setSaving(false); }
  }}>
    <h3>{t("Language preferences")}</h3>
    <p className={styles.help}>{t(signedInEmail ? "Saved to your account for your next visit." : "Log in to save both languages to your account.")}</p>
    <label htmlFor={id + "-site"}>{t("Site language")}</label>
    <select id={id + "-site"} value={site} disabled={saving || preferencesLoading} onChange={event => { setSite(event.target.value as Locale); setStatus(""); }}>
      {LOCALES.map(locale => <option key={locale} value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>)}
    </select>
    <label htmlFor={id + "-result"}>{t("Grading result language")}</label>
    <select id={id + "-result"} value={result} disabled={saving || preferencesLoading} onChange={event => { setResult(event.target.value as Locale); setStatus(""); }}>
      {LOCALES.map(locale => <option key={locale} value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>)}
    </select>
    <p className={styles.help}>{t("New feedback will use this language, independently of the site language.")}</p>
    {preferencesError && <p className={styles.error} role="alert">{t(preferencesError)} <button type="button" onClick={retryPreferences}>{t("Try again")}</button></p>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
    <div className={styles.saveRow}><button className={styles.save} type="submit" disabled={saving || preferencesLoading || !changed}>{t(saving ? "Saving…" : preferencesLoading ? "Loading…" : "Save languages")}</button><span role="status">{t(status)}</span></div>
  </form>;
}
