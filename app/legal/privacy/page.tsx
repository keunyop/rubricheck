import { getTranslator, getLocale } from "../../../src/i18n/server";
import type { Metadata } from "next";
import { buildMetadata } from "../../../src/lib/seo";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export async function generateMetadata(): Promise<Metadata> { return buildMetadata({
  locale: await getLocale(),
  title: "Privacy Policy",
  description: "How RubriCheck collects, uses, and protects personal data.",
  path: "/legal/privacy",
}); }

export default async function PrivacyPolicyPage() {
  const t = await getTranslator();
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{t("Privacy Policy")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700"> {t("Last updated: October 22, 2026. This Privacy Policy explains what information RubriCheck processes, why we process it, and the choices available to you.")} </p>
        <p className="mt-3 text-sm leading-6 text-slate-700"> {t("RubriCheck does not sell personal information. Access to user data is restricted to authorized systems and personnel for security, support, and product operations.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Information We Process")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Depending on usage, we may process rubric text, assignment text, uploaded files, evaluation outputs, assignment and project names, version history, account email, entitlement status, payment session metadata, and anti-abuse telemetry such as IP-derived usage counters.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("How We Use Information")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("We use data to deliver grading and rewrite suggestion features, enforce free and paid limits, save account-specific rubrics and their original files for reuse, maintain assignment history and project versions, prevent abuse, troubleshoot issues, and maintain service performance and security.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Actual Scores and Comments")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("If you choose to save an actual result, we store your score, comments, optional course and assignment details, and permission choices with the saved AI estimate. Personal record storage, internal service quality validation, and anonymized public case use are separate choices. Quality validation and public case use are optional, require their own permission, and do not affect your access. You can edit or delete the record, or withdraw either optional permission by unchecking it and saving. Records are not published automatically. New evaluations include model and prompt identifiers and an input fingerprint so comparable repeated checks can be identified.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Payments and Billing")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Billing is handled through third-party processors. RubriCheck stores only the minimum billing-related data needed to reconcile entitlements and support account recovery. Full payment card details are not stored by RubriCheck.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Data Sharing")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Data may be shared with trusted service providers that support hosting, analytics, AI processing, and payments under contractual obligations. Data may also be disclosed where required by law or to protect users and service integrity.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Optional usage analytics")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{t("With your permission, we measure public page visits and evaluation, signup and checkout steps using a pseudonymous browser identifier. We link these steps to a pseudonymous account identifier after verification. We retain only approved campaign names, public landing paths, referrer categories and country when available. Assignment content, names, emails and payment secrets are not sent to analytics providers. Turn optional analytics off using the control at the bottom of the page. Do Not Track and Global Privacy Control disable optional collection.")}</p>
        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Your Choices")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("You may request access, correction, or deletion of eligible personal data. Some records may be retained as required for legal, accounting, fraud prevention, or security reasons.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Contact")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("For privacy requests, use the support channel listed on the product site and include the email associated with your account.")} </p>
      <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Language settings and translations")}</h2>
<p className="mt-2 text-sm leading-6 text-slate-700">{t("Your site and grading language preferences are saved with your account until account data deletion. Translations use the existing AI provider and are cached for up to 24 hours. Translating a result does not change your saved original result or account preferences.")}</p>
</section>
    </main>
  );
}
