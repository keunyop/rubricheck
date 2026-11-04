import type { Metadata } from "next";
import { getLocale, getTranslator } from "../../src/i18n/server";
import { buildMetadata, buildWebPageSchema, absoluteUrl } from "../../src/lib/seo";
import { QuizOverview } from "../components/QuizOverview";
import { JsonLd } from "../components/JsonLd";
import styles from "../quizzes/quiz.module.css";

const title = "AI Quiz Generator from PDFs & Notes | RubriCheck";
const description = "Create multiple-choice and true/false quizzes from assignments, PDFs, slides and notes. Sign up for 10 free questions. Pro has no monthly generation limit.";
export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);
  const meta = buildMetadata({ title: t(title), description: t(description), path: "/ai-quiz-generator", locale });
  const image = absoluteUrl("/ai-quiz-generator/opengraph-image");
  return { ...meta, title: { absolute: t(title) }, openGraph: { ...meta.openGraph, images: [{ url: image, width: 1200, height: 630, alt: t("Quiz generator") }] }, twitter: { ...meta.twitter, images: [image] } };
}
export default async function QuizGeneratorPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);
  return <main id="main-content" className={styles.page}><JsonLd data={buildWebPageSchema({ title: t(title), description: t(description), path: "/ai-quiz-generator", locale })} /><QuizOverview /></main>;
}
