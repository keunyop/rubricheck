import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { JsonLd } from "./components/JsonLd";
import { buildMetadata, buildSoftwareApplicationSchema, buildWebPageSchema } from "../src/lib/seo";
import { getLocale } from "../src/i18n/server";
import { HOME_SEO } from "../src/i18n/homeSeo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = HOME_SEO[locale];
  return { ...buildMetadata({ ...copy, path: "/", locale }), title: { absolute: copy.title } };
}

export default async function HomePage() {
  const locale = await getLocale();
  const copy = HOME_SEO[locale];
  return <>
    <JsonLd data={buildWebPageSchema({ title: copy.title, description: copy.description, path: "/", locale })} />
    <JsonLd data={buildSoftwareApplicationSchema({ description: copy.description, path: "/", locale })} />
    <HomePageClient />
  </>;
}
