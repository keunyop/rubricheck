import type { Metadata } from "next";
import { getLocale, getTranslator } from "../../src/i18n/server";
import { buildMetadata } from "../../src/lib/seo";
import { HelpCenter } from "../components/HelpCenter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return buildMetadata({ title: t("Help center"), description: t("Find answers about RubriCheck uploads, feedback, accounts, billing, and data, or contact the team for help."), path: "/help", locale: await getLocale() });
}

export default function HelpPage() { return <HelpCenter />; }
