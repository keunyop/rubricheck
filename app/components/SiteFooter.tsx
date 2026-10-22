"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGUAGE_NAMES, LOCALES, localizedPath } from "../../src/i18n/config";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import { FeedbackButton } from "./FeedbackButton";
import styles from "./site.module.css";

const groups = [
  { title: "Product", links: [["/product", "Meet RubriCheck"], ["/pricing", "Compare plans"], ["/help", "Help center"]] },
  { title: "Resources", links: [["/how-to-use-a-rubric-to-check-an-assignment", "How to use a rubric"], ["/essay-rubric-checker", "Essay guide"], ["/assignment-rubric-checker", "Assignment guide"]] },
  { title: "Trust & policies", links: [["/legal/privacy", "Privacy"], ["/legal/terms", "Terms"], ["/legal/refund-policy", "Refund Policy"], ["/legal/ai-disclaimer", "AI Disclaimer"], ["/legal/data-retention", "Data Retention"]] },
];

export function SiteFooter({ workspace = false, onPricing }: { workspace?: boolean; onPricing?: () => void }) {
  const { t, href, siteLanguage } = useLanguage();
  const { signedInEmail } = useAccountSummary();
  const pathname = usePathname();
  return <footer className={styles.footer}>
    <div className={styles.footerGrid}>
      <div className={styles.footerBrand}>
        <p>RubriCheck<span aria-hidden="true">.</span></p>
        <p>{t("A clearer next step for every draft.")}</p>
        <FeedbackButton email={signedInEmail} />
      </div>
      {groups.map(group => <nav key={group.title} aria-label={t(group.title)}>
        <h2>{t(group.title)}</h2>
        {group.links.map(([url, label]) => <Link key={url} href={href(url)}
          target={workspace && url !== "/pricing" ? "_blank" : undefined} rel={workspace ? "noopener" : undefined}
          onClick={url === "/pricing" && onPricing ? (event: MouseEvent<HTMLAnchorElement>) => {
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onPricing(); }
          } : undefined}>
          {t(label)}{workspace && url !== "/pricing" ? <span className="sr-only"> ({t("opens in a new tab")})</span> : null}
        </Link>)}
      </nav>)}
    </div>
    <div className={styles.footerBottom}>
      <p>{t("AI-generated estimate only. Not an official grade. RubriCheck.")}</p>
      {!workspace ? <nav aria-label={t("Site language")} className={styles.languages}>
        {LOCALES.map(locale => <Link key={locale} href={localizedPath(pathname, locale)} hrefLang={locale} lang={locale} aria-current={siteLanguage === locale ? "page" : undefined}>{LANGUAGE_NAMES[locale]}</Link>)}
      </nav> : null}
    </div>
  </footer>;
}
