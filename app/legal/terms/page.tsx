import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | RubriCheck",
  description: "Terms governing the use of RubriCheck.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          By using RubriCheck, you agree to use the service responsibly and in compliance with
          applicable institutional rules and local laws.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          RubriCheck provides AI-assisted educational guidance and does not guarantee grades,
          admissions outcomes, or official institutional decisions.
        </p>
      </section>
    </main>
  );
}
