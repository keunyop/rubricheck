import { getTranslator, getLocale } from "../../../src/i18n/server";
import type { Metadata } from "next";
import { buildMetadata } from "../../../src/lib/seo";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export async function generateMetadata(): Promise<Metadata> { return buildMetadata({
  locale: await getLocale(),
  title: "Data Retention Policy",
  description: "How long RubriCheck stores evaluation and billing data.",
  path: "/legal/data-retention",
}); }

export default async function DataRetentionPolicyPage() {
  const t = await getTranslator();
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{t("Data Retention Policy")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700"> {t("Last updated: October 22, 2026. This policy summarizes default retention windows for RubriCheck data categories.")} </p>
        <p className="mt-3 text-sm leading-6 text-slate-700"> {t("Actual retention may vary by legal obligations, fraud prevention needs, and incident response requirements.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Evaluation Data")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Saved evaluation results, assignment titles, and projects remain linked to your account so you can revisit feedback and track versions. They are retained until account data deletion is requested. Deleting a project moves its assignments to Recents.")} </p>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Raw rubric and assignment inputs used for result recovery are stored for 24 hours. A linked checkout may extend recovery to seven days. Uploaded files and raw inputs are not included in the persistent assignment history. Browser drafts expire after 24 hours.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Actual Scores and Comments")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Actual scores, comments, optional course and assignment details, the saved AI estimate, and your permission choices remain in your account until you delete the actual result or request account data deletion. Deleting an actual result keeps the AI evaluation. Quality validation and anonymized public case use each require a separate optional permission. You can withdraw either permission by editing the record and saving. Records are not published automatically. New evaluations also retain model and prompt identifiers and a fingerprint of the inputs for comparing repeated checks.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("My Rubrics")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("After a successful signed-in check, your rubric text, structured criteria, and original rubric files are saved separately in My rubrics. Your 50 most recently used rubrics are retained across devices until you remove them, they are replaced by more recent rubrics, or account data deletion is requested. Guest previews and general criteria are not added to this library. The seven-day rubric processing cache is separate from the library.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Guest Previews")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Guest preview inputs and results are stored for 24 hours so you can recover the summary and link the feedback to your account after email verification. Linked results follow the account history retention described above. A browser cookie and hashed browser usage marker last up to one year to enforce the one-preview limit. A hashed IP usage marker lasts 24 hours to limit repeat previews from the same network.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Usage and Security Logs")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Technical logs and rate-limit counters may be retained for operational security, reliability analysis, and abuse detection, then deleted or anonymized according to system policies.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Billing and Entitlement Records")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Subscription, top-up, and entitlement records are retained for the period needed for accounting, tax, chargeback handling, and legal compliance.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Optional usage analytics")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{t("Journey events are kept for 90 days and payment reporting records for 400 days, with daily cleanup. Payment attribution is removed after 90 days. Account attribution is cleared after 90 days of inactivity, and inactive account reporting records after 400 days. These pseudonymous records are server-only and available only to authorized administrators. Existing accounting and entitlement records follow their separate retention rules.")}</p>
        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Deletion Requests")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("You can request deletion of eligible personal data through support. Some records may be excluded from deletion where retention is required by law, fraud prevention, or legitimate security interests.")} </p>
      <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Language settings and translations")}</h2>
<p className="mt-2 text-sm leading-6 text-slate-700">{t("Your site and grading language preferences are saved with your account until account data deletion. Translations use the existing AI provider and are cached for up to 24 hours. Translating a result does not change your saved original result or account preferences.")}</p>
</section>
    </main>
  );
}
