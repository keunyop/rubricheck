import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Retention Policy | RubriCheck",
  description: "How long RubriCheck stores evaluation and billing data.",
};

export default function DataRetentionPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Data Retention Policy</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Evaluation inputs and generated feedback are retained for up to 30 days to support access,
          abuse prevention, and troubleshooting.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Billing and transaction records are retained for the period required by accounting and
          legal obligations. Eligible data deletion requests can be submitted through support.
        </p>
      </section>
    </main>
  );
}
