import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How RubriCheck collects, uses, and protects personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <Link href="/" className="text-sm font-medium text-indigo-700 hover:text-indigo-600">
          Back to RubriCheck
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          RubriCheck collects rubric text, assignment drafts, and account-related metadata to
          operate evaluation features, manage billing, and maintain service reliability.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          We do not sell your personal data. Access to submitted content is limited to authorized
          systems and personnel for security, support, and quality improvement purposes.
        </p>
      </section>
    </main>
  );
}
