import type { Metadata } from "next";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How RubriCheck collects, uses, and protects personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Last updated: February 26, 2026. This Privacy Policy explains what information RubriCheck
          processes, why we process it, and the choices available to you.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          RubriCheck does not sell personal information. Access to user data is restricted to
          authorized systems and personnel for security, support, and product operations.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Information We Process</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Depending on usage, we may process rubric text, assignment text, uploaded files,
          evaluation outputs, account email, entitlement status, payment session metadata, and
          anti-abuse telemetry such as IP-derived usage counters.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">How We Use Information</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          We use data to deliver grading and rewrite suggestion features, enforce free and paid
          limits, prevent abuse, troubleshoot issues, and maintain service performance and security.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Payments and Billing</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Billing is handled through third-party processors. RubriCheck stores only the minimum
          billing-related data needed to reconcile entitlements and support account recovery. Full
          payment card details are not stored by RubriCheck.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Data Sharing</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Data may be shared with trusted service providers that support hosting, analytics, AI
          processing, and payments under contractual obligations. Data may also be disclosed where
          required by law or to protect users and service integrity.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Your Choices</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          You may request access, correction, or deletion of eligible personal data. Some records
          may be retained as required for legal, accounting, fraud prevention, or security reasons.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Contact</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          For privacy requests, use the support channel listed on the product site and include the
          email associated with your account.
        </p>
      </section>
    </main>
  );
}
