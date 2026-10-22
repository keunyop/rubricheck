"use client";

import { useState } from "react";
import Link from "next/link";
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpCategory } from "../../src/config/help";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import { FeedbackButton } from "./FeedbackButton";
import styles from "./help.module.css";

export function HelpCenter() {
  const { t, href, siteLanguage } = useLanguage();
  const { signedInEmail } = useAccountSummary();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory>("All topics");
  const search = query.trim().normalize("NFKC").toLocaleLowerCase(siteLanguage);
  const articles = HELP_ARTICLES.filter(item => (category === "All topics" || item.category === category) &&
    `${t(item.question)} ${t(item.answer)} ${t(item.category)}`.normalize("NFKC").toLocaleLowerCase(siteLanguage).includes(search));

  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <div className={styles.container}>
      <header className={styles.intro}><p className={styles.eyebrow}>{t("RubriCheck support")}</p><h1>{t("A little help for your next step.")}</h1><p>{t("Find an answer, get back to your draft.")}</p>
        <div className={styles.search}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><label htmlFor="help-search" className="sr-only">{t("Search help articles")}</label><input id="help-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search uploads, billing, feedback…")} /></div>
      </header>
      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h2>{t("Browse by topic")}</h2>
          <div role="group" aria-label={t("Help topics")} className={styles.topics}>{HELP_CATEGORIES.map(item => <button type="button" key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>{t(item)}<span aria-hidden="true">↗</span></button>)}</div>
          <div className={styles.quickStart}><p>{t("New here?")}</p><Link href={href("/product")}>{t("Take a product tour")} <span aria-hidden="true">→</span></Link></div>
        </aside>
        <section aria-labelledby="help-results-title" className={styles.results}>
          <div className={styles.resultsHeading}><h2 id="help-results-title">{search ? t("Search results") : t(category)}</h2><p role="status" aria-live="polite">{t("{count} articles", { count: articles.length })}</p></div>
          <div key={`${category}:${search}:${siteLanguage}`} className={styles.articles}>{articles.map(item => <details key={item.id} open={search ? true : undefined}>
            <summary>{t(item.question)}<span aria-hidden="true">+</span></summary><div className={styles.answer}><p>{t(item.answer)}</p>{item.link ? <Link href={href(item.link.href)}>{t(item.link.label)} <span aria-hidden="true">→</span></Link> : null}</div>
          </details>)}</div>
          {!articles.length ? <div className={styles.empty}><h3>{t("No matching articles")}</h3><p>{t("Try a shorter search or browse all topics. You can also contact us below.")}</p><button type="button" onClick={() => { setQuery(""); setCategory("All topics"); }}>{t("Clear search and filters")}</button></div> : null}
          <section className={styles.support} aria-labelledby="contact-title"><div><p className={styles.eyebrow}>{t("We’re here to help")}</p><h2 id="contact-title">{t("Still need a hand?")}</h2><p>{t("Tell us what happened and leave your email if you would like a reply.")}</p></div><FeedbackButton email={signedInEmail} label="Contact support" /></section>
        </section>
      </div>
    </div>
  </main>;
}
