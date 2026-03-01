import type { Metadata } from "next";
import Link from "next/link";

import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund terms for RubriCheck Pro subscriptions and top-up credits.",
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Refund Policy</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Last updated: February 28, 2026. This policy explains how cancellations and refunds work
          for RubriCheck subscriptions and top-up credits.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Pro subscriptions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          You may cancel a Pro subscription at any time from the Billing and refunds page. When a
          subscription is canceled, the cancellation applies to the next renewal. Pro access
          remains available until the current billing period ends.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Except where required by law, subscription charges for the current billing period are not
          refunded on a prorated basis after a subscription has started.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Top-up credits</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Purchased top-up credits may be refunded only to the extent they remain unused. Refunds
          are returned to the original payment method through our payment processor.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          The first 3 free evaluations included with the product are promotional usage and are not
          refundable. Any credits that have already been used are also not refundable.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">How to request a refund</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Sign in, open{" "}
          <Link href="/billing/manage" className="font-semibold text-slate-900 underline underline-offset-2">
            Billing and refunds
          </Link>
          , and use the available refund action if your account has unused purchased top-up
          credits.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Exceptions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          We may refuse or reverse refund requests in cases involving abuse, fraud, chargeback
          misuse, or attempts to obtain evaluation output without payment. Nothing in this policy
          limits any non-waivable consumer rights that apply under local law.
        </p>
      </section>
    </main>
  );
}
