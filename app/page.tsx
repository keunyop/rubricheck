import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProductOverview } from "./components/ProductOverview";
import { getCreditEmailFromCookie } from "../src/lib/creditSession";
import { localizedPath } from "../src/i18n/config";
import { JsonLd } from "./components/JsonLd";
import { buildMetadata, buildSoftwareApplicationSchema, buildWebPageSchema } from "../src/lib/seo";
import { getLocale } from "../src/i18n/server";
import { HOME_SEO } from "../src/i18n/homeSeo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = HOME_SEO[locale];
  return { ...buildMetadata({ ...copy, path: "/", locale }), title: { absolute: copy.title } };
}

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props = {}) {
  const [locale, params, requestHeaders] = await Promise.all([getLocale(), searchParams, headers()]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  // Preserve saved result links and checkout returns issued before the route split.
  const workspaceIntent = ["evaluation_id", "checkout_session_id", "checkout_canceled", "start"].some(key => query.has(key));
  const signedIn = getCreditEmailFromCookie(new Request("https://rubricheck.com", { headers: requestHeaders }));
  if (workspaceIntent || signedIn) {
    redirect(localizedPath("/workspace", locale) + (query.size ? "?" + query.toString() : ""));
  }
  const copy = HOME_SEO[locale];
  return <>
    <JsonLd data={buildWebPageSchema({ title: copy.title, description: copy.description, path: "/", locale })} />
    <JsonLd data={buildSoftwareApplicationSchema({ description: copy.description, path: "/", locale })} />
    <ProductOverview home />
  </>;
}
