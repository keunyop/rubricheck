import type { Locale } from "./config";
import { messages } from "./messages";
export function translate(locale: Locale, message: string, values?: Record<string, string | number>): string {
  const entry = messages[message];
  const text = locale === "en" || !entry ? message : entry[locale === "ko" ? 0 : 1];
  return values ? text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match)) : text;
}
