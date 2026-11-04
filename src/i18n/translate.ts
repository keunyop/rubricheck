import type { Locale } from "./config";
import { messages } from "./messages";
import { newLanguages } from "./newLanguages";
import { quizMessages } from "./quiz";
export function translate(locale: Locale, message: string, values?: Record<string, string | number>): string {
  const entry = messages[message];
  const index = { hi: 0, ur: 1, vi: 2, zh: 3 } as const;
  const quizIndex = { ko: 0, ms: 1, hi: 2, ur: 3, vi: 4, zh: 5 } as const;
  const text = locale !== "en" && quizMessages[message] ? quizMessages[message][quizIndex[locale]] : locale === "ko" ? entry?.[0] ?? message : locale === "ms" ? entry?.[1] ?? message : locale === "en" ? message : newLanguages[message]?.[index[locale]] ?? message;
  return values ? text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match)) : text;
}
