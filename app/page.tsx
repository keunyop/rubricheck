import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { JsonLd } from "./components/JsonLd";
import {
  DEFAULT_OG_IMAGE_PATH,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
  absoluteUrl,
} from "../src/lib/seo";

const homeSeoTitle = "RubriCheck | AI Rubric Checker";
const homeStructuredDataTitle = "AI Rubric Checker for Assignments and Essays";
const homeDescription =
  "Check your essay or assignment against your own rubric. Get estimated scores and revision priorities before submission. Try RubriCheck for free.";

export const metadata: Metadata = {
  title: {
    absolute: homeSeoTitle,
  },
  description: homeDescription,
  keywords: [
    "rubric checker",
    "ai rubric grader",
    "assignment rubric checker",
    "essay rubric checker",
    "rubric feedback tool",
    "grade prediction rubric tool",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    siteName: "RubriCheck",
    title: homeSeoTitle,
    description: homeDescription,
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
        width: 1200,
        height: 630,
        alt: homeSeoTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: homeSeoTitle,
    description: homeDescription,
    images: [absoluteUrl(DEFAULT_OG_IMAGE_PATH)],
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={buildWebPageSchema({
          title: homeStructuredDataTitle,
          description: homeDescription,
          path: "/",
        })}
      />
      <JsonLd
        data={buildSoftwareApplicationSchema({
          description: homeDescription,
          path: "/",
        })}
      />
      <HomePageClient />
    </>
  );
}
