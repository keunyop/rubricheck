import { getTranslator, getLocale } from "../../../src/i18n/server";
import type { Metadata } from "next";
import { buildMetadata } from "../../../src/lib/seo";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export async function generateMetadata(): Promise<Metadata> { return buildMetadata({
  locale: await getLocale(),
  title: "Terms of Service",
  description: "Terms governing the use of RubriCheck.",
  path: "/legal/terms",
}); }

export default async function TermsOfServicePage() {
  const t = await getTranslator();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{t("Terms of Service")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700"> {t("Last updated: February 26, 2026. By accessing or using RubriCheck, you agree to these Terms of Service.")} </p>
        <p className="mt-3 text-sm leading-6 text-slate-700"> {t("If you do not agree with these terms, discontinue use of the service.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Permitted Use")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("You agree to use RubriCheck for lawful educational and writing support purposes and to comply with your school, institution, and local law requirements. You are responsible for the content you submit.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("AI Output Limitations")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("RubriCheck provides AI-assisted estimates and rewrite suggestions. Outputs are informational only and are not official grades, institutional decisions, or professional advice.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Accounts and Access")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("You are responsible for maintaining access to your verification email and for activity on your session. We may suspend or restrict access for abuse, fraud, excessive automated traffic, or attempts to bypass technical controls.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Paid Plans and Credits")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("Paid subscriptions and top-ups are billed through third-party processors. Pricing, billing periods, and included usage are shown at checkout. Refund handling follows the Refund Policy, applicable payment terms, and local consumer law.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Service Availability")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("We work to provide reliable service, but uninterrupted availability is not guaranteed. Features may change, be updated, or be removed with or without prior notice.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Liability")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("To the maximum extent permitted by law, RubriCheck is provided on an \"as is\" basis without warranties of specific outcomes. You remain responsible for your final submission decisions and academic compliance.")} </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">{t("Changes to Terms")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700"> {t("We may update these terms periodically. Continued use after updates means acceptance of the revised terms.")} </p>
      </section>
    </main>
  );
}
