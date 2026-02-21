import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Checkout canceled</h1>
        <p className="mt-3 text-sm text-slate-600">
          No charge was made. You can try upgrading again anytime.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
        >
          Back to RubriCheck
        </Link>
      </section>
    </main>
  );
}
