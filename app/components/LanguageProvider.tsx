"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isLocale, localeFromPath, localizedPath, stripLocale, LOCALE_COOKIE, type LanguagePreferences, type Locale } from "../../src/i18n/config";
import { HOME_SEO } from "../../src/i18n/homeSeo";
import { translate } from "../../src/i18n/translate";
import { useAccountSummary } from "./AccountSummaryProvider";

type LanguageContextValue = LanguagePreferences & {
  t: (message: string, values?: Record<string, string | number>) => string;
  href: (path: string) => string;
  savePreferences: (preferences: LanguagePreferences) => Promise<void>;
  preferencesLoading: boolean;
  preferencesError: string;
  retryPreferences: () => void;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const { signedInEmail, hasLoadedAccountSummary } = useAccountSummary();
  const pathname = usePathname();
  const [siteLanguage, setSiteLanguage] = useState<Locale>(initialLocale);
  const [resultLanguage, setResultLanguage] = useState<Locale>(initialLocale);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [retry, setRetry] = useState(0);
  const identity = useRef(signedInEmail);
  identity.current = signedInEmail;
  const revision = useRef(0);
  const previousPath = useRef(pathname);

  const applySiteLanguage = useCallback((locale: Locale) => {
    setSiteLanguage(locale);
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const path = localizedPath(location.pathname + location.search + location.hash, locale);
    if (path !== location.pathname + location.search + location.hash) {
      // Server-rendered articles must load their translated content as well.
      if (stripLocale(location.pathname) !== "/") { window.location.replace(path); return; }
      // Keep uploads, the open modal and results when switching the workspace language.
      window.history.replaceState(null, "", path);
    }
    if (stripLocale(location.pathname) === "/") {
      document.title = HOME_SEO[locale].title;
      document.querySelector('meta[name="description"]')?.setAttribute("content", HOME_SEO[locale].description);
    }
    previousPath.current = path.split(/[?#]/)[0];
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const locale = localeFromPath(pathname);
    setSiteLanguage(locale);
    document.documentElement.lang = locale;
  }, [pathname]);

  useEffect(() => {
    if (!hasLoadedAccountSummary) return;
    const email = signedInEmail;
    const currentRevision = ++revision.current;
    const controller = new AbortController();
    setPreferencesError("");
    setResultLanguage(initialLocale);
    if (!email) {
      setPreferencesLoading(false);
      const saved = document.cookie.split("; ").find(part => part.startsWith(LOCALE_COOKIE + "="))?.split("=")[1];
      if (isLocale(saved) && location.pathname === "/") applySiteLanguage(saved);
      return () => controller.abort();
    }
    setPreferencesLoading(true);
    void fetch("/api/account/preferences", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Could not load language preferences. Try again.");
      const { preferences } = await response.json();
      if (revision.current !== currentRevision || identity.current !== email) return;
      if (preferences && isLocale(preferences.siteLanguage) && isLocale(preferences.resultLanguage)) {
        applySiteLanguage(preferences.siteLanguage);
        setResultLanguage(preferences.resultLanguage);
      }
    }).catch(error => {
      if (!controller.signal.aborted && revision.current === currentRevision) setPreferencesError(error instanceof Error ? error.message : "Could not load language preferences. Try again.");
    }).finally(() => { if (!controller.signal.aborted && revision.current === currentRevision) setPreferencesLoading(false); });
    return () => controller.abort();
    // The account changes the defaults; navigation must not reload or overwrite them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInEmail, hasLoadedAccountSummary, retry, applySiteLanguage]);

  const savePreferences = useCallback(async (preferences: LanguagePreferences) => {
    const email = identity.current;
    if (email) {
      const response = await fetch("/api/account/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) });
      if (!response.ok) throw new Error("Could not save language preferences. Try again.");
      if (identity.current !== email) throw new Error("Your account changed. Please try again.");
    }
    revision.current++;
    setPreferencesLoading(false);
    setPreferencesError("");
    applySiteLanguage(preferences.siteLanguage);
    setResultLanguage(preferences.resultLanguage);
  }, [applySiteLanguage]);
  const t = useCallback((message: string, values?: Record<string, string | number>) => translate(siteLanguage, message, values), [siteLanguage]);
  const href = useCallback((path: string) => localizedPath(path, siteLanguage), [siteLanguage]);
  return <LanguageContext.Provider value={{ siteLanguage, resultLanguage, t, href, savePreferences, preferencesLoading: !hasLoadedAccountSummary || preferencesLoading, preferencesError, retryPreferences: () => setRetry(value => value + 1) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
