"use client";

import { LandingEntry } from "./LandingEntry";
import { HomeResources } from "./HomeResources";
import { QuizSample } from "./QuizSample";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { SAMPLE_EVALUATION as sample } from "../../src/config/sampleEvaluation";
import { FREE_TRIAL_LIMIT } from "../../src/config/plans";
import styles from "./product.module.css";

const steps = [
  ["Bring your draft", "Upload your assignment and rubric, or paste the text. No rubric? Start with general criteria."],
  ["Find the gaps", "Review estimated scores against the criteria and see where your draft needs attention."],
  ["Revise with a plan", "Start with the leading improvement priority, make your edits, and check your next version."],
];

export function ProductOverview({ home = false }: { home?: boolean }) {
  const { t, href } = useLanguage();
  const [selected, setSelected] = useState(1);
  const [mode, setMode] = useState<"assignment" | "quiz">("assignment");
  const criterion = sample.rubric[selected];
  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <div className={styles.container}>
      <LandingEntry home={home} />
      <section className={styles.heroSection} data-mode={mode} aria-labelledby="product-title">
        <div className={styles.modeTabs} role="tablist" aria-label={t("Product")}>
          {(["assignment", "quiz"] as const).map(value => <button
            key={value} id={`product-tab-${value}`} type="button" role="tab"
            aria-selected={mode === value} aria-controls="product-panel"
            tabIndex={mode === value ? 0 : -1} data-mode={value}
            onClick={() => setMode(value)}
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "assignment" : event.key === "End" ? "quiz" : mode === "assignment" ? "quiz" : "assignment";
              setMode(next);
              document.getElementById(`product-tab-${next}`)?.focus();
            }}
          ><span aria-hidden="true" className={styles.modeDot} />{t(value === "assignment" ? "Assignment" : "Quiz generator")}</button>)}
        </div>
        <div className={styles.hero} id="product-panel" role="tabpanel" aria-labelledby={`product-tab-${mode}`} tabIndex={0}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t(mode === "assignment" ? "From first draft to final review" : "Learn at your own pace")}</p>
          <h1 id="product-title">{mode === "assignment" ? <>{t("Know what to improve.")} <span>{t("Before you submit.")}</span></> : t("Turn your study materials into quizzes")}</h1>
          <p className={styles.intro}>{t(mode === "assignment" ? "Upload your assignment and rubric. Get clear feedback for your next draft." : "Create multiple-choice and true/false questions from assignments, PDFs, slides and notes.")}</p>
          <div className={styles.actions}>
            <Link href={href(mode === "assignment" ? "/workspace" : "/quizzes?view=create")} className={styles.primary}>{t(mode === "assignment" ? "Check my draft for free" : "Create a quiz")} <span aria-hidden="true">↗</span></Link>
          </div>
          <p className={styles.note}>{t(mode === "assignment" ? "One free summary preview. No sign-up or card required." : "Sign up for 10 free questions in total.")}</p>
          {mode === "quiz" && <Link href={href("/ai-quiz-generator")} className={styles.textLink}>{t("Explore the quiz generator")} <span aria-hidden="true">→</span></Link>}
        </div>
        {mode === "assignment" ? <section id="sample-feedback" className={styles.preview} aria-labelledby="preview-title">
          <div className={styles.previewTop}><span className={styles.statusDot} aria-hidden="true" />{t("Sample · Illustrative result")}</div>
          <div className={styles.previewBody}>
            <h2 id="preview-title">{t(sample.title)}</h2>
            <div className={styles.scoreRow}><div><p>{t("Estimated Score Range")}</p><strong>{sample.overallRange}<small> / 100</small></strong></div><span className={styles.scoreMark} aria-hidden="true">↗</span></div>
            <p className={styles.previewHint}>{t("Explore a criterion to see the feedback.")}</p>
            <div className={styles.criteria} role="group" aria-label={t("Sample rubric")}>
              {sample.rubric.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index} aria-controls="sample-criterion-feedback" onClick={() => setSelected(index)}>
                <span>{t(item.name)}</span><span>{item.range.join("–")} <small>/ {item.max}</small></span>
                <span className={styles.track} aria-hidden="true"><span style={{ width: `${item.range[1] / item.max * 100}%` }} /></span>
              </button>)}
            </div>
            <div id="sample-criterion-feedback" className={styles.feedback} aria-live="polite" aria-atomic="true"><p>{t(criterion.name)}</p><p>{t(criterion.feedback)}</p></div>
            <p className={styles.sampleNote}>{t("Prepared example. No check is used. AI estimates are not official grades.")}</p>
          </div>
        </section> : <QuizSample />}
        </div>
      </section>

      <section id="how-it-works" className={styles.section} aria-labelledby="steps-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{t("A simple review loop")}</p><h2 id="steps-title">{t("Your rubric. Your draft. Your next step.")}</h2></div><p>{t("For students reviewing their work and educators guiding a revision.")}</p></div>
        <ol className={styles.steps}>{steps.map(([title, description], index) => <li key={title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{t(title)}</h3><p>{t(description)}</p></li>)}</ol>
      </section>

      <section className={styles.workflow} aria-labelledby="workflow-title">
        <div><p className={styles.eyebrow}>{t("Built for the next draft, too")}</p><h2 id="workflow-title">{t("Give your revisions a home.")}</h2><p>{t("Sign in to keep your work organized, return to previous feedback, and reuse the rubrics you already added.")}</p><Link href={href("/help")} className={styles.textLink}>{t("Explore the help center")} <span aria-hidden="true">→</span></Link></div>
        <div className={styles.featureList}>
          {[["01", "Assignment history", "Return to saved evaluations from Recents without uploading the same work again."], ["02", "Projects & versions", "Keep related drafts in a project so each version has its own feedback."], ["03", "Reusable rubrics", "Open My rubrics to use a saved rubric for your next assignment."]].map(([number, title, description]) => <article key={title}><span aria-hidden="true">{number}</span><div><h3>{t(title)}</h3><p>{t(description)}</p></div></article>)}
        </div>
      </section>

      <section className={styles.trust} aria-labelledby="trust-title">
        <div><p className={styles.eyebrow}>{t("Clear expectations")}</p><h2 id="trust-title">{t("Useful feedback. Informed decisions.")}</h2></div>
        <div className={styles.trustGrid}>
          <article><h3>{t("You stay in control")}</h3><p>{t("Review suggestions against your rubric and follow your institution’s rules. Your instructor determines the official grade.")}</p><Link href={href("/legal/ai-disclaimer")}>{t("AI feedback limitations")} <span aria-hidden="true">↗</span></Link></article>
          <article><h3>{t("Understand your data")}</h3><p>{t("Read what is processed, how saved work is retained, and how to request deletion before uploading sensitive information.")}</p><Link href={href("/legal/data-retention")}>{t("Data Retention")} <span aria-hidden="true">↗</span></Link></article>
          <article><h3>{t("Start with what you need")}</h3><p>{t("Try a preview, then sign up for {count} free checks. Credits and Pro unlock more feedback; rewrite suggestions require Pro.", { count: FREE_TRIAL_LIMIT })}</p><Link href={href("/pricing")}>{t("Compare plans")} <span aria-hidden="true">↗</span></Link></article>
        </div>
      </section>
      <section className={styles.cta} aria-labelledby="cta-title"><div><p className={styles.eyebrow}>{t("Make your next revision count")}</p><h2 id="cta-title">{t("Start with the draft you have.")}</h2><p>{t("Bring your own rubric or use general criteria to get started.")}</p></div><Link href={href("/workspace")} className={styles.primary}>{t("Check my draft for free")} <span aria-hidden="true">↗</span></Link></section>
      {home ? <HomeResources /> : null}
    </div>
  </main>;
}
