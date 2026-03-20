import Link from "next/link";
import { SubpageBackHomeLink } from "./SubpageBackHomeLink";
import type { SeoLandingPageContent } from "../../src/config/seoPages";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
} from "../../src/lib/seo";
import { JsonLd } from "./JsonLd";

type SeoLandingPageProps = {
  page: SeoLandingPageContent;
};

export function SeoLandingPage({ page }: SeoLandingPageProps) {
  const breadcrumbItems = [
    { name: "Home", path: "/" },
    { name: page.h1, path: page.path },
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#ffffff_100%)] px-4 py-10 text-slate-900">
      <JsonLd
        data={buildWebPageSchema({
          title: page.title,
          description: page.description,
          path: page.path,
        })}
      />
      <JsonLd
        data={buildSoftwareApplicationSchema({
          description: page.description,
          path: page.path,
          name: page.h1,
        })}
      />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />
      <JsonLd data={buildFaqSchema(page.faqItems)} />

      <section className="mx-auto w-full max-w-5xl space-y-8">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <SubpageBackHomeLink />
          <div className="mt-4 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
              {page.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {page.h1}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-700 md:text-lg">
              {page.intro}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={page.ctaHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {page.ctaLabel}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              View pricing
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {page.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700 md:text-[15px]">
                {section.body}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Frequently asked questions
          </h2>
          <div className="mt-5 space-y-3">
            {page.faqItems.map((item) => (
              <details
                key={item.question}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm md:p-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-slate-900">
              Related pages
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700 md:text-[15px]">
              These pages support adjacent search intent and help students move
              from discovery into the product.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {page.relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <p className="text-base font-semibold text-slate-900">
                  {link.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
