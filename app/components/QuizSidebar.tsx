"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { useAccountSummary } from "./AccountSummaryProvider";
import { LanguageSettings } from "./LanguageSettings";
import { WorkspaceIcon, WorkspaceModeNavigation } from "./AssignmentSidebar";
import { SidebarAccountControls } from "./SidebarAccountControls";
import { isKnownAdminEmail } from "../../src/config/admin";
import type { QuizSummary } from "../../src/lib/quizTypes";
import styles from "./assignmentWorkspace.module.css";

export function QuizSidebar({ children, email = "", quizzes = [], selectedId, library = false, loading = false, loginHref, onNewQuiz, accountDialogRef }: {
  children: ReactNode;
  email?: string;
  quizzes?: QuizSummary[];
  selectedId?: string | null;
  library?: boolean;
  loading?: boolean;
  loginHref?: string;
  onNewQuiz?: () => void;
  accountDialogRef?: RefObject<HTMLDialogElement | null>;
}) {
  const { t, href } = useLanguage();
  const { accountPlan, creditBalance, remainingEvaluations, clearAccountSummary } = useAccountSummary();
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const mobile = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const localAccount = useRef<HTMLDialogElement>(null);
  const account = accountDialogRef ?? localAccount;

  useEffect(() => {
    // Restore the same sidebar preference when switching workspaces.
    try { setExpanded(localStorage.getItem("rubricheck_sidebar") !== "closed"); } catch {}
    const media = window.matchMedia("(min-width: 768px)");
    const closeMobile = () => { if (media.matches) mobile.current?.close(); };
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); mobile.current?.close(); search.current?.showModal();
      }
    };
    media.addEventListener("change", closeMobile);
    window.addEventListener("keydown", openSearch);
    return () => { media.removeEventListener("change", closeMobile); window.removeEventListener("keydown", openSearch); };
  }, []);

  function toggle() {
    setExpanded(value => { try { localStorage.setItem("rubricheck_sidebar", value ? "closed" : "open"); } catch {} return !value; });
  }
  function closeNavigation() { mobile.current?.close(); search.current?.close(); }
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError("");
    try {
      const response = await fetch("/api/account/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      clearAccountSummary();
      window.location.assign(href("/workspace"));
    } catch { setLogoutError("Could not log out. Try again."); setLoggingOut(false); }
  }
  const filtered = quizzes.filter(quiz => `${quiz.title} ${quiz.sources.map(source => source.name).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const content = (isMobile: boolean) => <>
    <div className={styles.sidebarHeader}>
      <span className={styles.brand}>RubriCheck</span>
      <button className={styles.iconButton} aria-label={t("Search quizzes")} onClick={() => { mobile.current?.close(); search.current?.showModal(); }}><WorkspaceIcon name="search" /></button>
      <button className={styles.iconButton} aria-label={t("Close sidebar")} onClick={() => isMobile ? mobile.current?.close() : toggle()}><WorkspaceIcon name="panel" /></button>
    </div>
    <div onClick={event => { if ((event.target as HTMLElement).closest("a")) closeNavigation(); }}><WorkspaceModeNavigation mode="quiz" onNewQuiz={onNewQuiz} /></div>
    <nav className={styles.sidebarScroll} aria-label={t("My quizzes")}>
      <Link href={href("/quizzes")} className={styles.navItem} data-active={library} aria-current={library ? "page" : undefined} onClick={closeNavigation}><WorkspaceIcon name="quiz" /><span>{t("My quizzes")}</span></Link>
      <div className={styles.sectionHeading}>{t("Recents")}</div>
      {loading && !quizzes.length ? <p className={styles.empty} role="status">{t("Loading…")}</p> : null}
      {!loading && !quizzes.length ? <p className={styles.empty}>{t("No quizzes yet.")}</p> : null}
      {quizzes.slice(0, 20).map(quiz => <Link key={quiz.id} href={href("/quizzes?id=" + quiz.id)} className={styles.navItem} data-active={selectedId === quiz.id} aria-current={selectedId === quiz.id ? "page" : undefined} title={quiz.title} onClick={closeNavigation}><WorkspaceIcon name="file" /><span>{quiz.title}</span></Link>)}
    </nav>
    <SidebarAccountControls email={email} loginHref={loginHref ?? href("/workspace?start=login")} onAccount={() => { mobile.current?.close(); account.current?.showModal(); }} />
  </>;

  return <div className={styles.shell} data-expanded={expanded} data-workspace="quiz">
    <a href="#main-content" className="skip-link">{t("Skip to content")}</a>
    <aside className={styles.desktopSidebar} aria-label={t("Sidebar")}>{content(false)}</aside>
    <div className={styles.content}>
      <div className={styles.openBar}>
        <button className={styles.desktopOpen} aria-label={t("Open sidebar")} onClick={toggle}><WorkspaceIcon name="panel" /></button>
        <button className={styles.mobileOpen} aria-label={t("Open sidebar")} aria-haspopup="dialog" onClick={() => mobile.current?.showModal()}><WorkspaceIcon name="menu" /></button>
        <span className={styles.workspaceLabel}>{t("Quiz generator")}</span>
      </div>
      {children}
    </div>
    <dialog ref={mobile} className={styles.mobileDialog} aria-label={t("Sidebar")} onClick={event => { if (event.target === event.currentTarget) mobile.current?.close(); }}><div className={styles.mobilePanel}>{content(true)}</div></dialog>
    <dialog ref={search} className={styles.dialog} aria-label={t("Search quizzes")} onClick={event => { if (event.target === event.currentTarget) search.current?.close(); }}>
      <div className={styles.dialogBody}>
        <div className={styles.dialogHeading}><h2>{t("Search quizzes")}</h2><button className={styles.iconButton} aria-label={t("Close search")} onClick={() => search.current?.close()}><WorkspaceIcon name="close" /></button></div>
        <label className={styles.searchInput}><WorkspaceIcon name="search" /><input autoFocus type="search" aria-label={t("Search quizzes")} placeholder={t("Quiz title or source name")} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className={styles.searchResults}>{filtered.map(quiz => <Link key={quiz.id} className={styles.searchResult} href={href("/quizzes?id=" + quiz.id)} onClick={closeNavigation}><WorkspaceIcon name="quiz" /><span>{quiz.title}</span></Link>)}{!filtered.length && <p className={styles.empty}>{t("No results found.")}</p>}</div>
      </div>
    </dialog>
    <dialog ref={account} className={styles.accountDialog} aria-label={t("Account menu")} onClick={event => { if (event.target === event.currentTarget) account.current?.close(); }}>
      <div className={styles.accountBody}>
        <div className={styles.accountHeading}><span className={styles.email}>{email || t("Language preferences")}</span><button className={styles.iconButton} aria-label={t("Close account menu")} onClick={() => account.current?.close()}><WorkspaceIcon name="close" /></button></div>
        {email && <section className={styles.accountOverview}><h2>{t("Account settings")}</h2><dl><div><dt>{t("Current plan")}</dt><dd>{t(accountPlan === "pro" ? "Pro" : accountPlan === "topup" ? "Top-up" : "Free")}</dd></div><div><dt>{t("Evaluations available")}</dt><dd>{accountPlan === "pro" ? t("Unlimited evaluations") : remainingEvaluations === null ? "—" : remainingEvaluations.toLocaleString()}</dd></div><div><dt>{t("Credit balance")}</dt><dd>{creditBalance === null ? "—" : creditBalance.toLocaleString()}</dd></div></dl></section>}
        {isKnownAdminEmail(email) && <Link href={href("/admin")} className={styles.accountItem}>{t("Admin")}</Link>}
        <Link href={href("/pricing")} className={styles.accountItem}>{t("Pricing")}</Link>
        {email && <Link href={href("/billing/manage")} className={styles.accountItem}>{t("Billing and refunds")}</Link>}
        <LanguageSettings />
        {logoutError && <p className={styles.error} role="alert">{t(logoutError)}</p>}
        {email && <button className={`${styles.accountItem} ${styles.logoutItem}`} disabled={loggingOut} onClick={() => void logout()}>{t("Log out")}</button>}
      </div>
    </dialog>
  </div>;
}
