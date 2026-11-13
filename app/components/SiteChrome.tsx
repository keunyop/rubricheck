"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { stripLocale } from "../../src/i18n/config";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import { SiteFooter } from "./SiteFooter";
import styles from "./site.module.css";

function NavigationLinks({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const { t, href, siteLanguage } = useLanguage();
  return <>
    {[["/product", "Product"], ["/ai-quiz-generator", "Quiz generator"], ["/pricing", "Pricing"], ["/help", "Help center"]].map(([url, label]) =>
      <Link key={url} href={href(url)} onClick={onNavigate} data-theme={url === "/ai-quiz-generator" ? "quiz" : undefined} aria-current={path === url ? "page" : undefined}>{t(label)}</Link>)}
    {siteLanguage === "en" && <Link href="/blog" onClick={onNavigate} aria-current={path.startsWith("/blog") ? "page" : undefined}>Blog</Link>}
  </>;
}

function PublicNavigation({ path, signedIn }: { path: string; signedIn: boolean }) {
  const { t, href } = useLanguage();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return <div className={styles.navigation} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus();
    }
  }}>
    <button ref={toggle} id="site-navigation-toggle" className={styles.menuToggle} type="button"
      aria-label={t("Main navigation")} aria-expanded={open} aria-controls="site-navigation"
      onClick={() => setOpen(value => !value)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d={open ? "M6 6l12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} />
      </svg>
    </button>
    <nav id="site-navigation" aria-label={t("Main navigation")} className={styles.nav} data-open={open}>
      <NavigationLinks path={path} onNavigate={() => setOpen(false)} />
      {!signedIn && <Link href={href("/workspace?start=login")} className={styles.mobileLogin} onClick={() => setOpen(false)}>{t("Log in")}</Link>}
    </nav>
  </div>;
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const { t, href } = useLanguage();
  const { signedInEmail } = useAccountSummary();
  const pathname = usePathname();
  const path = stripLocale(pathname).replace(/\/$/, "") || "/";
  if (path === "/workspace" || path === "/quizzes" || /^\/(admin|billing)(\/|$)/.test(path)) return children;

  return <>
    <a href="#main-content" className="skip-link">{t("Skip to content")}</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href={href("/")} className={styles.brand} aria-label={t("RubriCheck home")}>
          <Image src="/rubricheck-tab-icon.svg" alt="" width={28} height={28} />RubriCheck
        </Link>
        <nav className={styles.desktopNav} aria-label={t("Main navigation")}><NavigationLinks path={path} /></nav>
        {!signedInEmail ? <Link href={href("/workspace?start=login")} className={styles.login}>{t("Log in")}</Link> : null}
        <Link href={href("/workspace")} className={styles.headerCta} aria-label={t("Open workspace")}><span className={styles.desktopLabel} aria-hidden="true">{t("Open workspace")}</span><span className={styles.mobileLabel} aria-hidden="true">{t("Workspace")}</span> <span aria-hidden="true">↗</span></Link>
        <PublicNavigation key={pathname} path={path} signedIn={Boolean(signedInEmail)} />
      </div>
    </header>
    {children}
    <div className={styles.footerContainer}><SiteFooter /></div>
  </>;
}
