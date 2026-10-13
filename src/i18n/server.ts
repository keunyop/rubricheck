import { headers } from "next/headers";
import { isLocale } from "./config";
import { translate } from "./translate";
export async function getLocale() {
  const value = (await headers()).get("x-rubricheck-locale");
  return isLocale(value) ? value : "en";
}
export async function getTranslator() {
  const locale = await getLocale();
  return (message: string, values?: Record<string, string | number>) => translate(locale, message, values);
}
