import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslator } from "../../src/i18n/server";
import { localizedPath } from "../../src/i18n/config";
import { getCreditEmailFromCookie } from "../../src/lib/creditSession";
import { buildNoIndexMetadata } from "../../src/lib/seo";
import { quizLoginPath } from "../../src/lib/quizTypes";
import { QuizApp } from "./QuizApp";
import { QuizSamples } from "../components/QuizOverview";
import styles from "./quiz.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return buildNoIndexMetadata(t("My quizzes"), t("Create, practice and review your private quizzes."));
}
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default async function QuizzesPage({ searchParams }: Props) {
  const [locale, t, requestHeaders, params] = await Promise.all([getLocale(), getTranslator(), headers(), searchParams]);
  const email = getCreditEmailFromCookie(new Request("https://rubricheck.com", { headers: requestHeaders }));
  const query = new URLSearchParams();
  for (const key of ["view", "assignment", "trial", "from", "id", "job", "retry"]) if (typeof params?.[key] === "string") query.set(key, params[key]);
  if (!email) return <main id="main-content" className={styles.page}>
    <nav className={styles.nav}><Link href={localizedPath("/", locale)}>RubriCheck</Link><Link href={localizedPath("/ai-quiz-generator", locale)}>{t("AI quiz generator")}</Link></nav>
    <section className={styles.hero}><h1>{t("Create a quiz")}</h1><p>{t("Sign up for 10 free questions in total.")}</p><div><Link className={styles.primary} href={quizLoginPath(localizedPath("/quizzes", locale) + (query.size ? "?" + query : ""), locale)}>{t("Log in")}</Link></div></section>
    <QuizSamples />
  </main>;
  return <QuizApp key={email} />;
}
