"use client";

import { useState } from "react";
import { FREE_TRIAL_LIMIT } from "../../src/config/plans";
import { useLanguage } from "./LanguageProvider";
import styles from "./quickStart.module.css";

export function QuickStartGuide({ initiallyOpen, disabled, onSignup }: { initiallyOpen: boolean; disabled: boolean; onSignup?: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(initiallyOpen);
  return <details className={styles.guide} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><strong>{t("Your first check, in three steps")}</strong><span>{t("See what to prepare and what you’ll get back.")}</span></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary>
    <div className={styles.body}>
      <ol className={styles.steps}>
        {[
          ["Add the grading criteria", "A rubric is your instructor’s scoring guide. Add it, or choose No rubric to use general criteria."],
          ["Add your assignment", "Upload your draft or paste its text. Put the assignment and rubric in their separate fields."],
          ["Review, then revise", "Review your estimated score and summary. Use the feedback to revise before submitting."],
        ].map(([title, description], index) => <li key={title}><span className={styles.number} aria-hidden="true">{index + 1}</span><div><h2>{t(title)}</h2><p>{t(description)}</p></div></li>)}
      </ol>
      <div className={styles.next}><p>{onSignup ? t("Explore the sample without using a check, or preview your own work. Create an account for {count} free checks; no card required.", { count: FREE_TRIAL_LIMIT }) : t("Your signed-in checks appear in Recents. Use a project when you want to keep multiple drafts together.")}</p>
        {onSignup ? <button type="button" disabled={disabled} onClick={onSignup}>{t("Create free account")} <span aria-hidden="true">→</span></button> : null}
      </div>
      <p className={styles.notice}>{t("AI-generated estimate only. Not an official grade. RubriCheck.")}</p>
    </div>
  </details>;
}
