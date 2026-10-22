import type { Metadata } from "next";
import { getLocale, getTranslator } from "../../src/i18n/server";
import { buildMetadata } from "../../src/lib/seo";
import { ProductOverview } from "../components/ProductOverview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return buildMetadata({ title: t("Meet RubriCheck"), description: t("See how RubriCheck turns your rubric and draft into estimated scores, revision priorities, and an organized review workflow."), path: "/product", locale: await getLocale() });
}

export default function ProductPage() { return <ProductOverview />; }
