import { localizeSeoGuide } from "../../src/i18n/seoGuides";
import { getLocale } from "../../src/i18n/server";
import type { Metadata } from "next";
import { SeoLandingPage } from "../components/SeoLandingPage";
import { getSeoLandingPage } from "../../src/config/seoPages";
import { buildMetadata } from "../../src/lib/seo";

const page = getSeoLandingPage("rubric-feedback-tool");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const localized = localizeSeoGuide(page, locale);
  return buildMetadata({
  locale,
  title: localized.title,
  description: localized.description,
  path: page.path,
  keywords: localized.keywords,
}); }

export default function RubricFeedbackToolPage() {
  return <SeoLandingPage page={page} />;
}
