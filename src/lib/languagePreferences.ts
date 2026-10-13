import { isLocale, type LanguagePreferences } from "../i18n/config";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
export const languagePreferencesKey = (email: string) => `rubricheck:preferences:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
function preferencesRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("PREFERENCES_UNAVAILABLE");
  return new Redis({ url, token });
}
export async function getLanguagePreferences(email: string): Promise<LanguagePreferences | null> {
  const value = await preferencesRedis().get<LanguagePreferences>(languagePreferencesKey(email));
  return value && isLocale(value.siteLanguage) && isLocale(value.resultLanguage) ? value : null;
}
export async function saveLanguagePreferences(email: string, preferences: LanguagePreferences) {
  await preferencesRedis().set(languagePreferencesKey(email), preferences);
}
