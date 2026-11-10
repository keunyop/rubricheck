"use client";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { QuizSample } from "./QuizSample";
import { useQuizDiscovery } from "./useQuizDiscovery";
import { trackQuiz } from "../../src/lib/quizAnalytics";
import sampleStyles from "./quizSample.module.css";
import styles from "../quizzes/quiz.module.css";

export function QuizSamples({ showCreateAction = false }: { showCreateAction?: boolean }) {
  const { t } = useLanguage();
  return <section className={sampleStyles.samples} aria-label={t("Sample quiz")}>
    <p className={sampleStyles.source}>{t("Sample source: A triangle has three sides. A square has four equal sides.")}</p>
    <div className={sampleStyles.sampleGrid}>
      <QuizSample showSource={false} headingLevel="h3" label="Sample · Multiple choice" showCreateAction={showCreateAction} />
      <QuizSample kind="true_false" showSource={false} headingLevel="h3" label="Sample · True / False" showCreateAction={showCreateAction} />
    </div>
  </section>;
}

export function QuizOverview({ compact = false }: { compact?: boolean }) {
  const { t, href } = useLanguage();
  const hero = useQuizDiscovery<HTMLDivElement>("hero");
  const Heading = compact ? "h2" : "h1";
  return <section className={compact ? styles.page : ""} aria-labelledby="quiz-title">
    <div className={styles.hero} ref={hero}><Heading id="quiz-title">{t("Turn your study materials into quizzes")}</Heading><p>{t("Create multiple-choice and true/false questions from assignments, PDFs, slides and notes.")}</p>
      <div className={styles.row}><span>{t("Review a graded assignment")}</span><span aria-hidden="true">·</span><span>{t("Upload materials to create a quiz")}</span></div>
      <div className={styles.actions}><Link className={styles.primary} href={href("/quizzes?view=create")} onClick={() => trackQuiz("quiz_create_clicked", "hero")}>{t("Create a quiz")}</Link>{compact && <Link className={styles.link} href={href("/ai-quiz-generator")}>{t("Explore the quiz generator")}</Link>}</div><p className={styles.muted}>{t("Sign up for 10 free questions in total.")}</p>
    </div>
    <QuizSamples showCreateAction />
    {!compact && <>
      <section className={styles.section}><h2>{t("Choose materials → Generate → Practice and review")}</h2><p>{t("Start from a grading result or upload your own materials. No prior grading is required. Select PDF pages, presentation slides or text paragraphs before generating.")}</p><p>{t("Use PDF, DOCX, PPTX, TXT, PNG or JPG.")}</p><p className={styles.muted}>{t("Up to 5 sources · 20 MB per file · 50 MB total")}</p><p className={styles.muted}>{t("Select up to 50 pages or slides, 50,000 characters and 50 MB in total.")}</p></section>
      <section className={styles.section}><h2>{t("Learn at your own pace")}</h2><p>{t("Check each answer with an explanation, resume your saved progress, and review mistakes without generating new questions.")}</p><p>{t("Pro · No monthly generation limit")}</p><p>{t("Monthly, annual and lifetime Pro include quizzes. Up to 20 questions per request; grading credits are separate.")}</p><Link className={styles.link} href={href("/pricing")}>{t("Compare plans")}</Link></section>
      <section className={styles.section}><h2>{t("Frequently asked questions")}</h2>{[
        ["Do I need an account?", "Yes. Sign in to create private quizzes. You can try the prepared sample without an account."],
        ["How many questions are free?", "Each account gets 10 generated questions in total, with no monthly reset. Only saved questions count; repeating a quiz is free."],
        ["Which materials can I use?", "Use assignments, textbooks, lecture slides or notes. Select a smaller chapter or range for long documents."],
        ["Can I study after a source expires?", "Yes. Saved questions, explanations and attempts remain available. Attach the source again to generate new questions."],
      ].map(([question, answer]) => <details key={question}><summary>{t(question)}</summary><p className={styles.muted}>{t(answer)}</p></details>)}</section>
    </>}
  </section>;
}
