import type { Metadata } from "next";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export const metadata: Metadata = {
  title: "Data Retention Policy",
  description: "How long RubriCheck stores evaluation and billing data.",
  alternates: {
    canonical: "/legal/data-retention",
  },
  openGraph: {
    url: "https://rubricheck.com/legal/data-retention",
  },
};

export default function DataRetentionPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Data Retention Policy</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Last updated: February 26, 2026. This policy summarizes default retention windows for
          RubriCheck data categories.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Actual retention may vary by legal obligations, fraud prevention needs, and incident
          response requirements.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Evaluation Data</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Rubric inputs, assignment inputs, and generated outputs are generally retained for up to
          30 days for abuse monitoring, troubleshooting, and quality review, unless a shorter or
          longer period is required for security or legal reasons.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Usage and Security Logs</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Technical logs and rate-limit counters may be retained for operational security,
          reliability analysis, and abuse detection, then deleted or anonymized according to system
          policies.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Billing and Entitlement Records</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Subscription, top-up, and entitlement records are retained for the period needed for
          accounting, tax, chargeback handling, and legal compliance.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Deletion Requests</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          You can request deletion of eligible personal data through support. Some records may be
          excluded from deletion where retention is required by law, fraud prevention, or legitimate
          security interests.
        </p>
      </section>
    </main>
  );
}
