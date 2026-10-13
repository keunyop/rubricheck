"use client";
import { useLanguage } from "./LanguageProvider";


import { ResultLanguageSelect, useResultTranslation } from "./ResultLanguageSelect";
import { useId } from "react";

import { SAMPLE_EVALUATION as sample } from "../../src/config/sampleEvaluation";
import type { TrialPreview } from "../../src/lib/trialPreview";
import { formatOverallScoreDisplay, SCORE_RANGE_NOTICE, SCORE_COMPARISON_NOTICE } from "../../src/lib/scorePresentation";
import { WorkspaceIcon } from "./AssignmentSidebar";
import workspaceStyles from "./assignmentWorkspace.module.css";
import styles from "./evaluationPreview.module.css";
import guestStyles from "./guestExperience.module.css";

const button = "rounded-xl border px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60";

export function GuestChoices({ sampleSelected, disabled, onSelect }: { sampleSelected: boolean; disabled: boolean; onSelect: (sample: boolean) => void }) {
  const { t } = useLanguage();
  const id = useId();
  const choices = [
    { sample: true, title: t("Try a sample"), description: t("Essay, rubric and feedback."), icon: "file" as const },
    { sample: false, title: t("Try your own assignment"), description: t("One free summary. No sign-up."), icon: "new" as const },
  ];

  return <section aria-label={t("Try RubriCheck")} className={guestStyles.choices}>
    <div className={guestStyles.choicesGrid}>
      {choices.map(choice => {
        const selected = sampleSelected === choice.sample;
        const choiceId = id + (choice.sample ? "-sample" : "-own");
        return <button key={choiceId} type="button" disabled={disabled} aria-pressed={selected}
          aria-labelledby={choiceId + "-title"} aria-describedby={choiceId + "-description"}
          onClick={() => onSelect(choice.sample)} className={guestStyles.choice}>
          <span className={guestStyles.choiceIcon}><WorkspaceIcon name={choice.icon} /></span>
          <span className={guestStyles.choiceCopy}>
            <span id={choiceId + "-title"} className={guestStyles.choiceTitle}>{choice.title}</span>
            <span id={choiceId + "-description"} className={guestStyles.choiceDescription}>{choice.description}</span>
          </span>
          <span className={guestStyles.choiceIndicator} aria-hidden="true">
            {selected ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 8 2.5 2.5L12 5" /></svg> : null}
          </span>
        </button>;
      })}
    </div>
  </section>;
}

function SummaryCard({ score, summary }: { score: string; summary: string }) {
  const { t } = useLanguage();
  return <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Estimated Score Range")}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-indigo-700 md:text-4xl">
        {score} <span className="text-xl md:text-2xl">/ 100</span>
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 md:text-sm">{t(SCORE_RANGE_NOTICE)}</p>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 md:text-sm">{t(SCORE_COMPARISON_NOTICE)}</p>
    </div>
    <p className="mt-4 text-sm leading-6 text-slate-700 md:text-[15px]">{summary}</p>
  </div>;
}

function CriteriaHeader() {
  const { t } = useLanguage();
  return <div className={styles.tableHeader} aria-hidden="true">
    <span>{t("Criteria")}</span><span>{t("Max")}</span><span>{t("Estimated")}</span><span>{t("Feedback")}</span>
  </div>;
}

function SampleCriteria() {
  const { t } = useLanguage();
  return <section aria-label={t("Evaluation Criteria")} className="mt-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-base font-semibold text-slate-900">{t("Evaluation Criteria")}</h4>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{t("3 criteria · 100 points")}</span>
    </div>
    <div className={styles.criteriaTable}>
      <CriteriaHeader />
      {sample.rubric.map((item, index) => <article key={t(item.name)} className={styles.criterionRow}>
        <div className={styles.criterionName}>
          <span className={styles.criterionNumber}>{String(index + 1).padStart(2, "0")}</span>
          <div><h5>{t(item.name)}</h5><span className={styles.mobileMax}>{t("Max:")} {item.max} {t("points")}</span></div>
        </div>
        <p className={styles.maxScore}>{item.max}</p>
        <div className={styles.estimate} aria-label={t("{low} to {high} out of {max} points", { low: item.range[0], high: item.range[1], max: item.max })}>
          <span className={styles.scoreBadge}>{item.range.join("–")}</span>
          <div className={styles.rangeTrack} aria-hidden="true">
            <span className={styles.rangeFill} style={{ width: item.range[1] / item.max * 100 + "%" }} />
            <span className={styles.rangeInterval} style={{ left: item.range[0] / item.max * 100 + "%", width: (item.range[1] - item.range[0]) / item.max * 100 + "%" }} />
          </div>
        </div>
        <p className={styles.criterionFeedback}>{t(item.feedback)}</p>
      </article>)}
    </div>
  </section>;
}

// Decorative rows only. Protected criterion data never enters the guest response or DOM.
function LockedCriteriaBackdrop() {
  return <div className={styles.lockedBackdrop} aria-hidden="true" inert>
    <CriteriaHeader />
    {[0, 1, 2].map(index => <div className={styles.criterionRow} key={index}>
      <div className={styles.criterionName}>
        <span className={styles.criterionNumber}>{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.placeholderTitle} />
      </div>
      <span className={styles.maxScore}><span className={styles.placeholderMax} /></span>
      <div className={styles.estimate}>
        <span className={styles.placeholderScore} />
        <div className={styles.rangeTrack}><span className={styles.rangeFill} style={{ width: "75%" }} /></div>
      </div>
      <div className={styles.criterionFeedback}>
        <span className={styles.placeholderLine} /><span className={styles.placeholderLine} /><span className={styles.placeholderShortLine} />
      </div>
    </div>)}
  </div>;
}

export function SampleExperience({ onTryOwn }: { onTryOwn: () => void }) {
  const { t } = useLanguage();
  return <section aria-label={t("Sample evaluation")} className="space-y-6 rounded-2xl border border-indigo-200 bg-white p-5 md:p-8">
    <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">{t("Sample · Illustrative result")}</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">{t(sample.title)}</h2>
      <p className="mt-2 text-sm text-slate-600">{t("This is a prepared example, not an evaluation of your work. It does not use a free check.")}</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label={t("Sample essay")} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="font-semibold text-slate-900">{t("Sample essay")}</h3>
        {sample.essay.map(paragraph => <p key={t(paragraph)} className="mt-3 text-sm leading-6 text-slate-700">{t(paragraph)}</p>)}
      </section>
      <section aria-label={t("Sample rubric")} className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h3 className="font-semibold text-slate-900">{t("Sample rubric")}</h3>
          <span className="text-xs font-medium text-slate-500">{t("100 points total")}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {sample.rubric.map((item, index) => <div key={t(item.name)} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                <span className="text-xs font-medium text-slate-400">{String(index + 1).padStart(2, "0")}</span>{t(item.name)}
              </h4>
              <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{item.max} {t("pts")}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t(item.description)}</p>
          </div>)}
        </div>
      </section>
    </div>
    <section aria-label={t("Sample result")} className="border-t border-slate-200 pt-6">
      <h3 className="border-b border-slate-100 pb-4 text-xl font-semibold text-slate-900">{t("Evaluation Summary")}</h3>
      <SummaryCard score={sample.overallRange} summary={t(sample.summary)} />
      <SampleCriteria />
    </section>
    <div className={guestStyles.sampleNextStep}>
      <div>
        <h3 className={guestStyles.nextStepTitle}>{t("Ready to check your own work?")}</h3>
        <p className={guestStyles.nextStepDescription}>{t("Start with your rubric and assignment draft.")}</p>
      </div>
      <button type="button" onClick={onTryOwn} className={guestStyles.nextStepButton}> {t("Try your own assignment")} <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
      </button>
    </div>
  </section>;
}

export function GuestSummary({ result: original, signedIn, busy, onUnlock }: { result: TrialPreview; signedIn: boolean; busy: boolean; onUnlock: () => void }) {
  const { t } = useLanguage();
  const translation = useResultTranslation(original);
  const result = translation.result!;
  return <section aria-label={t("Your evaluation preview")} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
    <div className={workspaceStyles.contextBar}>
      <div className={workspaceStyles.contextTitle}><WorkspaceIcon name="file" /><span>{t("Assignment")}</span></div>
      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{t("Free preview")}</span>
    </div>
    <div className="border-b border-slate-100 pb-4">
      {result.grading_basis === "general" ? <span className="mb-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{t("General criteria")}</span> : null}
      <div className="flex flex-wrap items-start gap-3"><h2 tabIndex={-1} id="guest-evaluation-summary" className="text-xl font-semibold text-slate-900 focus:outline-none">{t("Evaluation Summary")}</h2><ResultLanguageSelect language={result.language} busy={translation.busy} error={translation.error} onChange={translation.change} /></div>
    </div>
    <SummaryCard score={formatOverallScoreDisplay(result.overall_range)} summary={result.summary} />
    <section aria-label={t("Locked evaluation criteria")} className="mt-6">
      <h3 className="mb-4 text-base font-semibold text-slate-900">{t("Evaluation Criteria")}</h3>
      <div className={styles.lockedCriteria}>
        <LockedCriteriaBackdrop />
        <div className={styles.unlockOverlay}>
          <div className={styles.unlockCard}>
            <span className={styles.lockIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="10" width="14" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
              </svg>
            </span>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">{t("Criteria feedback is locked")}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t("Sign up to see feedback for each criterion in this evaluation. Your preview is saved for 24 hours.")}</p>
            <p className="mt-3 text-sm font-semibold text-indigo-700">{t("3 free checks · No card required")}</p>
            <button type="button" disabled={busy} onClick={onUnlock} className={button + " mt-5 w-full border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-500"}>
              {busy ? t("Opening feedback...") : signedIn ? t("Open criterion feedback") : t("Sign up to see criterion feedback")}
            </button>
          </div>
        </div>
      </div>
    </section>
  </section>;
}

