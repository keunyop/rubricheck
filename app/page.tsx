import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { JsonLd } from "./components/JsonLd";
import { HOME_FAQ_ITEMS } from "../src/config/seoPages";
import {
  buildFaqSchema,
  buildMetadata,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
} from "../src/lib/seo";

const homeTitle = "AI Rubric Checker for Assignments and Essays";
const homeDescription =
  "RubriCheck is an AI rubric checker for students. Upload an assignment and rubric to estimate likely scores, get criterion-level feedback, and revise before submission.";

export const metadata: Metadata = buildMetadata({
  title: homeTitle,
  description: homeDescription,
  path: "/",
  keywords: [
    "rubric checker",
    "ai rubric grader",
    "assignment rubric checker",
    "essay rubric checker",
    "rubric feedback tool",
    "grade prediction rubric tool",
  ],
});

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={buildWebPageSchema({
          title: homeTitle,
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
      <JsonLd data={buildFaqSchema(HOME_FAQ_ITEMS)} />
      <HomePageClient />
    </>
  );
}
