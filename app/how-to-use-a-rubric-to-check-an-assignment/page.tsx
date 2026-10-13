import { localizeSeoGuide } from "../../src/i18n/seoGuides";
import { getLocale } from "../../src/i18n/server";
import type { Metadata } from "next";
import { SeoLandingPage } from "../components/SeoLandingPage";
import { getSeoLandingPage } from "../../src/config/seoPages";
import { buildMetadata } from "../../src/lib/seo";

const page = getSeoLandingPage("how-to-use-a-rubric-to-check-an-assignment");

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

export default function HowToUseARubricPage() {
  return <SeoLandingPage page={page} />;
}
