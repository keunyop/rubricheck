"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { stripLocale } from "../../src/i18n/config";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import { SiteFooter } from "./SiteFooter";
import styles from "./site.module.css";

export function SiteChrome({ children }: { children: ReactNode }) {
  const { t, href } = useLanguage();
  const { signedInEmail } = useAccountSummary();
  const path = stripLocale(usePathname()).replace(/\/$/, "") || "/";
  if (path === "/workspace" || /^\/(admin|billing)(\/|$)/.test(path)) return children;

  return <>
    <a href="#main-content" className="skip-link">{t("Skip to content")}</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href={href("/")} className={styles.brand} aria-label={t("RubriCheck home")}>
          <Image src="/rubricheck-logo.svg" alt="" width={32} height={34} />RubriCheck
        </Link>
        <nav aria-label={t("Main navigation")} className={styles.nav}>
          {[["/product", "Product"], ["/pricing", "Pricing"], ["/help", "Help center"]].map(([url, label]) =>
            <Link key={url} href={href(url)} aria-current={path === url ? "page" : undefined}>{t(label)}</Link>)}
        </nav>
        {!signedInEmail ? <Link href={href("/workspace?start=login")} className={styles.login}>{t("Log in")}</Link> : null}
        <Link href={href("/workspace")} className={styles.headerCta} aria-label={t("Open workspace")}><span className={styles.desktopLabel} aria-hidden="true">{t("Open workspace")}</span><span className={styles.mobileLabel} aria-hidden="true">{t("Workspace")}</span> <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
    {children}
    <div className={styles.footerContainer}><SiteFooter /></div>
  </>;
}
