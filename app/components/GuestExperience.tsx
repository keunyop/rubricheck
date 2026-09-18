"use client";

import { SAMPLE_EVALUATION as sample } from "../../src/config/sampleEvaluation";
import type { TrialPreview } from "../../src/lib/trialPreview";
import { SCORE_RANGE_NOTICE } from "../../src/lib/scorePresentation";

const button = "rounded-xl border px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
export function GuestChoices({ sampleSelected, disabled, onSelect }: { sampleSelected: boolean; disabled: boolean; onSelect: (sample: boolean) => void }) {
  return <section aria-label="Try RubriCheck" className="space-y-3">
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={disabled} aria-pressed={sampleSelected} onClick={() => onSelect(true)}
        className={button + (sampleSelected ? " border-indigo-600 bg-indigo-600 text-white" : " border-slate-300 bg-white text-slate-700")}>Try a sample</button>
      <button type="button" disabled={disabled} aria-pressed={!sampleSelected} onClick={() => onSelect(false)}
        className={button + (!sampleSelected ? " border-indigo-600 bg-indigo-600 text-white" : " border-slate-300 bg-white text-slate-700")}>Try your own assignment</button>
    </div>
    <p className="text-sm text-slate-600">{sampleSelected ? "Explore a short essay, its rubric, and an example result. No sign-up needed." : "Get one free Evaluation Summary before signing up. Up to 20,000 characters per input. Sign up to see criterion feedback."}</p>
  </section>;
}
export function SampleExperience({ onTryOwn }: { onTryOwn: () => void }) {
  return <section aria-label="Sample evaluation" className="space-y-5 rounded-2xl border border-indigo-200 bg-white p-5 md:p-8">
    <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Sample · Illustrative result</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">{sample.title}</h2>
      <p className="mt-2 text-sm text-slate-600">This is a prepared example, not an evaluation of your work. It does not use a free check.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="Sample essay" className="rounded-xl bg-slate-50 p-5">
        <h3 className="font-semibold text-slate-900">Sample essay</h3>
        {sample.essay.map(paragraph => <p key={paragraph} className="mt-3 text-sm leading-6 text-slate-700">{paragraph}</p>)}
      </section>
      <section aria-label="Sample rubric" className="rounded-xl bg-slate-50 p-5">
        <h3 className="font-semibold text-slate-900">Sample rubric · 100 points</h3>
        {sample.rubric.map(item => <div key={item.name} className="mt-4"><h4 className="text-sm font-semibold">{item.name} · {item.max} points</h4><p className="mt-1 text-sm leading-6 text-slate-700">{item.description}</p></div>)}
      </section>
    </div>
    <section aria-label="Sample result" className="space-y-4 border-t border-slate-200 pt-5">
      <h3 className="text-lg font-semibold">Evaluation Summary</h3>
      <p className="text-3xl font-semibold text-indigo-700">{sample.overallRange} / 100</p>
      <p className="text-xs text-slate-500">{SCORE_RANGE_NOTICE}</p>
      <p className="text-sm leading-6 text-slate-700">{sample.summary}</p>
      <h4 className="font-semibold">Criteria</h4>
      <div className="grid gap-3 md:grid-cols-3">{sample.rubric.map(item => <article key={item.name} className="rounded-xl border border-slate-200 p-4">
        <h5 className="text-sm font-semibold">{item.name} · {item.range.join("–")} / {item.max}</h5><p className="mt-2 text-sm leading-6 text-slate-700">{item.feedback}</p>
      </article>)}</div>
    </section>
    <button type="button" onClick={onTryOwn} className={button + " border-indigo-600 bg-indigo-600 text-white"}>Try your own assignment</button>
  </section>;
}
export function GuestSummary({ result, signedIn, busy, onUnlock }: { result: TrialPreview; signedIn: boolean; busy: boolean; onUnlock: () => void }) {
  return <section aria-label="Your evaluation preview" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Your assignment · Free preview</p>
    <h2 tabIndex={-1} id="guest-evaluation-summary" className="text-xl font-semibold text-slate-900 focus:outline-none">Evaluation Summary</h2>
    <p className="text-3xl font-semibold text-indigo-700">{result.overall_range.join("–")} / 100</p>
    <p className="text-xs text-slate-500">{SCORE_RANGE_NOTICE}</p>
    <p className="text-sm leading-6 text-slate-700">{result.summary}</p>
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="font-semibold text-slate-900">Criteria feedback is locked</h3>
      <p className="mt-2 text-sm text-slate-700">Sign up to see feedback for each criterion in this evaluation. Your preview is saved for 24 hours.</p>
      <p className="mt-2 text-sm font-semibold text-indigo-700">3 free checks · No card required</p>
      <button type="button" disabled={busy} onClick={onUnlock} className={button + " mt-4 border-indigo-600 bg-indigo-600 text-white"}>
        {busy ? "Opening feedback..." : signedIn ? "Open criterion feedback" : "Sign up to see criterion feedback"}
      </button>
    </div>
  </section>;
}

