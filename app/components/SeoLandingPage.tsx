import Link from "next/link";
import type { SeoLandingPageContent } from "../../src/config/seoPages";
import { FREE_TRIAL_LIMIT } from "../../src/config/plans";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../../src/lib/seo";
import { JsonLd } from "./JsonLd";

export function SeoLandingPage({ page }: { page: SeoLandingPageContent }) {
  const breadcrumbItems = [
    { name: "Home", path: "/" },
    { name: page.h1, path: page.path },
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#ffffff_100%)] px-4 py-10 text-slate-900">
      <JsonLd data={buildWebPageSchema({ title: page.title, description: page.description, path: page.path })} />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] md:p-8">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="underline underline-offset-4">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{page.h1}</li>
            </ol>
          </nav>
          <div className="mt-5 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">{page.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{page.h1}</h1>
            <p className="mt-4 text-base leading-7 text-slate-700 md:text-lg">{page.intro}</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={page.ctaHref} className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">{page.ctaLabel}</Link>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">View pricing</Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Start with {FREE_TRIAL_LIMIT} free trial evaluations. Detailed feedback and Strict mode are available with credits or Pro.
          </p>
        </section>

        <section aria-label="Review guide" className="grid gap-4 md:grid-cols-2">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700 md:text-[15px]">{section.body}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="worked-example" className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm md:p-8">
          <h2 id="worked-example" className="text-2xl font-semibold">{page.example.title}</h2>
          <p className="mt-3 leading-7 text-slate-700">{page.example.description}</p>
          <div role="region" aria-label={page.example.title} tabIndex={0} className="mt-5 overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-600">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">{page.example.title}</caption>
              <thead className="bg-indigo-50">
                <tr>{page.example.columns.map((column) => <th key={column} scope="col" className="p-4 font-semibold">{column}</th>)}</tr>
              </thead>
              <tbody>
                {page.example.rows.map((row) => (
                  <tr key={row[0]} className="border-t border-slate-200 align-top">
                    <th scope="row" className="p-4 font-medium">{row[0]}</th>
                    <td className="p-4 leading-6 text-slate-700">{row[1]}</td>
                    <td className="p-4 leading-6 text-slate-700">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">{page.example.note}</p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {page.faqItems.map((item) => (
              <details key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <summary className="cursor-pointer text-sm font-semibold">{item.question}</summary>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-semibold">More ways to review your draft</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">Find guidance for your assignment type or learn how to apply the feedback.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {page.relatedLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md">
                <h3 className="text-base font-semibold">{link.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>
        <footer className="flex flex-wrap gap-x-5 gap-y-3 px-2 text-sm text-slate-600">
          <Link href="/">RubriCheck</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/ai-disclaimer">AI feedback limitations</Link>
        </footer>
      </div>
    </main>
  );
}
