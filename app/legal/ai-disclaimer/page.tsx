import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Disclaimer",
  description: "Important limitations for RubriCheck AI-generated feedback.",
};

export default function AIDisclaimerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <Link href="/" className="text-sm font-medium text-indigo-700 hover:text-indigo-600">
          Back to RubriCheck
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">AI Disclaimer</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          This is an AI-generated estimate, not official grading.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Always verify feedback with your rubric, assignment instructions, and instructor guidance
          before making final submission decisions.
        </p>
      </section>
    </main>
  );
}
