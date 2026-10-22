import type { Metadata } from "next";
import HomePageClient from "../HomePageClient";
import { getLocale, getTranslator } from "../../src/i18n/server";
import { HOME_SEO } from "../../src/i18n/homeSeo";
import { buildMetadata, buildNoIndexMetadata } from "../../src/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslator();
  const title = t("Workspace");
  const description = HOME_SEO[locale].description;
  return {
    ...buildMetadata({ title, description, path: "/workspace", locale }),
    ...buildNoIndexMetadata(title, description),
  };
}

export default function WorkspacePage() { return <HomePageClient />; }
