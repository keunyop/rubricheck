import type { Locale } from "./config";
import { messages } from "./messages";
import { newLanguages } from "./newLanguages";
export function translate(locale: Locale, message: string, values?: Record<string, string | number>): string {
  const entry = messages[message];
  const index = { hi: 0, ur: 1, vi: 2, zh: 3 } as const;
  const text = locale === "ko" ? entry?.[0] ?? message : locale === "ms" ? entry?.[1] ?? message : locale === "en" ? message : newLanguages[message]?.[index[locale]] ?? message;
  return values ? text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match)) : text;
}
