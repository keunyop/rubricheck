import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Checkout canceled</h1>
        <p className="mt-3 text-sm text-slate-600">
          No charge was made. You can try upgrading again anytime.
        </p>
      </section>
    </main>
  );
}
