import type { Metadata } from "next";
import { SeoLandingPage } from "../components/SeoLandingPage";
import { getSeoLandingPage } from "../../src/config/seoPages";
import { buildMetadata } from "../../src/lib/seo";

const page = getSeoLandingPage("how-to-use-a-rubric-to-check-an-assignment");

export const metadata: Metadata = buildMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  keywords: page.keywords,
});

export default function HowToUseARubricPage() {
  return <SeoLandingPage page={page} />;
}
