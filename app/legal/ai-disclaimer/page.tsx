import type { Metadata } from "next";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export const metadata: Metadata = {
  title: "AI Disclaimer",
  description: "Important limitations for RubriCheck AI-generated feedback.",
  alternates: {
    canonical: "/legal/ai-disclaimer",
  },
  openGraph: {
    url: "https://rubricheck.com/legal/ai-disclaimer",
  },
};

export default function AIDisclaimerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">AI Disclaimer</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Last updated: February 26, 2026. RubriCheck uses AI models to generate feedback,
          estimated score ranges, and rewrite suggestions.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          AI outputs can be incomplete, inaccurate, outdated, biased, or inconsistent with your
          instructor&apos;s grading expectations.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Not Official Grading</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          RubriCheck is not an official school platform unless explicitly adopted by your
          institution. Outputs are guidance only and must not be treated as final grades.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">User Responsibility</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          You are responsible for reviewing all generated content, verifying factual claims,
          ensuring citations are accurate, and complying with assignment rules and academic
          integrity policies.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Rewrite Suggestions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Rewrite suggestions are meant to help improve clarity and rubric alignment. They are not
          guarantees of higher grades and may still require editing for tone, evidence, or
          assignment-specific constraints.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Appropriate Use</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Do not rely on RubriCheck as a substitute for professional legal, medical, financial, or
          safety advice. Use human judgment for high-impact decisions.
        </p>
      </section>
    </main>
  );
}
