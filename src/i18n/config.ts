export const LOCALES = ["en", "ko", "ms"] as const;
export type Locale = typeof LOCALES[number];
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ko: "한국어", ms: "Bahasa Melayu" };
export const MODEL_LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ko: "Korean (한국어)", ms: "Malay (Bahasa Melayu, Malaysia; not Indonesian)" };
export const LOCALE_COOKIE = "rubricheck_language";
export type LanguagePreferences = { siteLanguage: Locale; resultLanguage: Locale };
export function isLocale(value: unknown): value is Locale { return LOCALES.includes(value as Locale); }
export function localeFromPath(path: string): Locale { const part = path.split("/")[1]; return isLocale(part) ? part : "en"; }
// Public content URLs choose their language. Saved defaults only restore at the
// neutral home entry or account pages that do not have localized public URLs.
export function shouldRestoreSiteLanguage(pathname: string): boolean {
  return pathname === "/" || /^\/(billing|admin)(\/|$)/.test(pathname);
}
export function stripLocale(path: string): string { return /^\/(en|ko|ms)(?=\/|$)/.test(path) ? path.replace(/^\/(en|ko|ms)/, "") || "/" : path; }
export function localizedPath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//") || /^\/(api|admin|billing|_next)(\/|$)/.test(path)) return path;
  const [pathname, ...tail] = path.split(/(?=[?#])/);
  const bare = stripLocale(pathname);
  return (locale === "en" ? bare : `/${locale}${bare === "/" ? "" : bare}`) + tail.join("");
}
