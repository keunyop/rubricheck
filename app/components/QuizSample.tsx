"use client";

import { useState } from "react";
import Link from "next/link";
import { trackQuiz } from "../../src/lib/quizAnalytics";
import { useLanguage } from "./LanguageProvider";
import styles from "./quizSample.module.css";

export function QuizSample({ kind = "mcq", showSource = true, label = "Sample quiz", headingLevel = "h2", showCreateAction = false }: {
  kind?: "mcq" | "true_false";
  showSource?: boolean;
  label?: string;
  headingLevel?: "h2" | "h3";
  showCreateAction?: boolean;
}) {
  const { t, href } = useLanguage();
  const [answer, setAnswer] = useState<number | null>(null);
  const isChoice = kind === "mcq";
  const correct = isChoice ? 0 : 1;
  const question = isChoice ? "How many sides does a triangle have?" : "A triangle has four sides.";
  const options = isChoice ? ["3", "4", "5", "6"] : [t("True"), t("False")];
  const Heading = headingLevel;

  return <section className={styles.card} aria-label={t(label)}>
    <div className={styles.top}><span className={styles.dot} aria-hidden="true" />{t("Sample · Illustrative result")}</div>
    <div className={styles.body}>
      {showSource && <p className={styles.source}>{t("Sample source: A triangle has three sides. A square has four equal sides.")}</p>}
      <div className={styles.questionHeading}><span>{t(isChoice ? "Sample · Multiple choice" : "Sample · True / False")}</span><span aria-hidden="true">{isChoice ? "01" : "02"}</span></div>
      <Heading className={styles.question}>{t(question)}</Heading>
      <div className={styles.options} role="group" aria-label={t(question)}>
        {options.map((value, index) => <button key={value} type="button" aria-pressed={answer === index} data-correct={answer !== null && index === correct} data-incorrect={answer === index && index !== correct} onClick={() => { if (answer === null) trackQuiz("quiz_sample_answered", "sample"); setAnswer(index); }}>
          <span className={styles.letter}>{isChoice ? String.fromCharCode(65 + index) : index === 0 ? "O" : "X"}</span>
          <span>{value}</span>
          {answer !== null && (answer === index || index === correct) && <span className={styles.mark} aria-hidden="true">{index === correct ? "✓" : "×"}</span>}
        </button>)}
      </div>
      <div className={styles.explanation} aria-live="polite" aria-atomic="true">
        {answer !== null ? <div><strong>{t(answer === correct ? "Correct" : "Incorrect")}</strong><p>{t(isChoice ? "A. A triangle has three sides; four sides describes a square in this source." : "X. A triangle has three sides, not four.")}</p></div> : <span>{t("Choose an answer")}</span>}
      </div>
      {showCreateAction && answer !== null && <div className={styles.createAction}>
        <Link href={href("/quizzes?view=create")} onClick={() => trackQuiz("quiz_create_clicked", "sample")}>{t("Create a quiz")} <span aria-hidden="true">→</span></Link>
        <p>{t("Sign up for 10 free questions in total.")}</p>
      </div>}
    </div>
  </section>;
}
