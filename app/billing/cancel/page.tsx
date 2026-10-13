import { getTranslator } from "../../../src/i18n/server";
import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../src/lib/seo";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export const metadata: Metadata = buildNoIndexMetadata(
  "Checkout Canceled",
  "Checkout status page for canceled RubriCheck purchases.",
);

export default async function BillingCancelPage() {
  const t = await getTranslator();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{t("Checkout canceled")}</h1>
        <p className="mt-3 text-sm text-slate-600"> {t("No charge was made. You can try upgrading again anytime.")} </p>
      </section>
    </main>
  );
}
