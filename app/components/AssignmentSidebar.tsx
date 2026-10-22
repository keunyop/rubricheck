"use client";
import { useLanguage } from "./LanguageProvider";


import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useAccountSummary } from "./AccountSummaryProvider";
import { LanguageSettings } from "./LanguageSettings";
import type { AssignmentHistoryItem, AssignmentProject, AssignmentWorkspace } from "../../src/lib/assignmentWorkspaceTypes";
import styles from "./assignmentWorkspace.module.css";

export function WorkspaceIcon({ name }: { name: "search" | "panel" | "menu" | "new" | "folder" | "plus" | "close" | "file" }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
    menu: <path d="M4 8h16M4 16h11" />,
    new: <><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" /><path d="m16 3 5 5-9 9-5 1 1-5Z" /></>,
    folder: <path d="M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

type Props = {
  children: ReactNode;
  accountDialogRef?: RefObject<HTMLDialogElement | null>;
  onAccountClose?: () => void;
  email: string;
  data: AssignmentWorkspace;
  loading: boolean;
  error: string;
  busy: boolean;
  selectedId?: string;
  projectId: string | null;
  onNew: () => void;
  onOpen: (item: AssignmentHistoryItem) => void;
  onProject: (project: AssignmentProject) => void;
  onCreate: (name: string) => Promise<void>;
  onLogin: () => void;
  onRetry: () => void;
  canAccessAdmin: boolean;
  onPricing: () => void;
  onLogout: () => void;
};

export function AssignmentSidebar(props: Props) {
  const { t, href } = useLanguage();
  const { accountPlan, remainingEvaluations, creditBalance } = useAccountSummary();
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const mobile = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const create = useRef<HTMLDialogElement>(null);
  const localAccount = useRef<HTMLDialogElement>(null);
  const account = props.accountDialogRef ?? localAccount;

  useEffect(() => {
    try { setExpanded(localStorage.getItem("rubricheck_sidebar") !== "closed"); } catch {}
    const media = window.matchMedia("(min-width: 768px)");
    const closeMobile = () => { if (media.matches) mobile.current?.close(); };
    media.addEventListener("change", closeMobile);
    return () => media.removeEventListener("change", closeMobile);
  }, []);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); mobile.current?.close(); search.current?.showModal();
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);
  useEffect(() => { search.current?.close(); create.current?.close(); mobile.current?.close(); account.current?.close(); setQuery(""); }, [props.email, account]);

  function closeAccount() { account.current?.close(); mobile.current?.close(); }

  function toggle() {
    setExpanded(value => { try { localStorage.setItem("rubricheck_sidebar", value ? "closed" : "open"); } catch {} return !value; });
  }
  function navigate(action: () => void) { if (props.busy) return; mobile.current?.close(); search.current?.close(); action(); }
  function newProject() {
    mobile.current?.close();
    if (!props.email) { props.onLogin(); return; }
    setProjectName(""); setCreateError(""); create.current?.showModal();
  }
  const filteredAssignments = props.data.assignments.filter(item => {
    const project = props.data.projects.find(project => project.id === item.projectId);
    return (item.title + " " + (project?.name ?? "")).toLowerCase().includes(query.trim().toLowerCase());
  });
  const filteredProjects = props.data.projects.filter(project => project.name.toLowerCase().includes(query.trim().toLowerCase()));

  const content = (isMobile: boolean) => <>
    <div className={styles.sidebarHeader}>
      <button className={styles.brand} onClick={() => navigate(props.onNew)} disabled={props.busy}>RubriCheck</button>
      <button className={styles.iconButton} aria-label={t("Search assignments")} title={t("Search assignments (Ctrl+K)")} onClick={() => { mobile.current?.close(); search.current?.showModal(); }}><WorkspaceIcon name="search" /></button>
      <button className={styles.iconButton} aria-label={t("Close sidebar")} title={t("Close sidebar")} onClick={() => isMobile ? mobile.current?.close() : toggle()}><WorkspaceIcon name="panel" /></button>
    </div>
    <button className={styles.newAssignment} onClick={() => navigate(props.onNew)} disabled={props.busy}><WorkspaceIcon name="new" />{t("New Assignment")}</button>
    <nav className={styles.sidebarScroll} aria-label={t("Assignments")}>
      <div className={styles.sectionHeading}><span>{t("Projects")}</span><button className={styles.iconButton} aria-label={t("New project")} title={t("New project")} onClick={newProject} disabled={props.busy}><WorkspaceIcon name="plus" /></button></div>
      {props.data.projects.map(project => <button key={project.id} className={styles.navItem} data-active={props.projectId === project.id} onClick={() => navigate(() => props.onProject(project))} disabled={props.busy} title={project.name}>
        <WorkspaceIcon name="folder" /><span>{project.name}</span>
      </button>)}
      {!props.data.projects.length && <button className={styles.mutedItem} onClick={newProject} disabled={props.busy}><WorkspaceIcon name="plus" />{t("New project")}</button>}
      <div className={styles.sectionHeading}><span>{t("Recents")}</span></div>
      {props.loading && !props.data.assignments.length ? <p className={styles.empty} role="status">{t("Loading assignments…")}</p> : null}
      {props.error ? <div className={styles.empty} role="alert">{t(props.error)}<button className={styles.textButton} onClick={props.onRetry}>{t("Try again")}</button></div> : null}
      {!props.loading && !props.error && !props.data.assignments.length ? <p className={styles.empty}>{props.email ? t("Your graded assignments appear here.") : t("Log in to see your assignments.")}</p> : null}
      {props.data.assignments.map(item => <button key={item.id} className={styles.navItem} data-active={props.selectedId === item.id} onClick={() => navigate(() => props.onOpen(item))} disabled={props.busy} title={item.title}><span>{item.title}</span></button>)}
    </nav>
    <div className={styles.sidebarFooter}>
      {props.email ? <button className={styles.accountTrigger} aria-label={t("Open account menu")} aria-haspopup="dialog" onClick={() => account.current?.showModal()}>
        <span className={styles.avatar} aria-hidden="true">{props.email[0].toUpperCase()}</span><span className={styles.email} title={props.email}>{props.email}</span><svg className={styles.accountMore} viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
      </button> : <div className="flex items-center gap-2"><button className={styles.login} onClick={() => { mobile.current?.close(); props.onLogin(); }}>{t("Log in")}</button><button className={styles.iconButton} aria-label={t("Language preferences")} title={t("Language preferences")} aria-haspopup="dialog" onClick={() => account.current?.showModal()}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></button></div>}
    </div>
  </>;

  return <div className={styles.shell} data-expanded={expanded}>
    <a href={href("#main-content")} className="skip-link">{t("Skip to content")}</a>
    <aside className={styles.desktopSidebar} aria-label={t("Sidebar")}>{content(false)}</aside>
    <div className={styles.content}>
      <div className={styles.openBar}>
        <button className={styles.desktopOpen} aria-label={t("Open sidebar")} title={t("Open sidebar")} onClick={toggle}><WorkspaceIcon name="panel" /></button>
        <button className={styles.mobileOpen} aria-label={t("Open sidebar")} aria-haspopup="dialog" onClick={() => mobile.current?.showModal()}><WorkspaceIcon name="menu" /></button>
      </div>
      {props.children}
    </div>
    <dialog ref={mobile} className={styles.mobileDialog} aria-label={t("Sidebar")} onClick={event => { if (event.target === event.currentTarget) mobile.current?.close(); }}><div className={styles.mobilePanel}>{content(true)}</div></dialog>
    <dialog ref={account} onClose={props.onAccountClose} className={styles.accountDialog} aria-label={t("Account menu")} onClick={event => { if (event.target === event.currentTarget) account.current?.close(); }}>
      <div className={styles.accountBody}>
        <div className={styles.accountHeading}><span className={styles.email} title={props.email}>{props.email || t("Language preferences")}</span><button className={styles.iconButton} aria-label={t("Close account menu")} onClick={() => account.current?.close()}><WorkspaceIcon name="close" /></button></div>
        {props.email ? <section className={styles.accountOverview} aria-labelledby="account-settings-title">
          <h2 id="account-settings-title">{t("Account settings")}</h2>
          <dl>
            <div><dt>{t("Current plan")}</dt><dd>{t(accountPlan === "pro" ? "Pro" : accountPlan === "topup" ? "Top-up" : "Free")}</dd></div>
            <div><dt>{t("Evaluations available")}</dt><dd>{accountPlan === "pro" ? t("Unlimited evaluations") : remainingEvaluations === null ? "\u2014" : remainingEvaluations.toLocaleString()}</dd></div>
            <div><dt>{t("Credit balance")}</dt><dd>{creditBalance === null ? "\u2014" : creditBalance.toLocaleString()}</dd></div>
          </dl>
        </section> : null}
        <nav aria-label={t("Account")}>
          {props.canAccessAdmin && <Link href={href("/admin")} className={styles.accountItem} onClick={closeAccount}>{t("Admin")}</Link>}
          <button className={styles.accountItem} onClick={() => { closeAccount(); props.onPricing(); }}>{t("Pricing")}</button>
          <Link href={href("/billing/manage")} className={styles.accountItem} onClick={closeAccount}>{t("Billing and refunds")}</Link>
          <LanguageSettings />
          {props.email && <button className={`${styles.accountItem} ${styles.logoutItem}`} onClick={() => { closeAccount(); props.onLogout(); }}>{t("Log out")}</button>}
        </nav>
      </div>
    </dialog>
    <dialog ref={search} className={styles.dialog} aria-labelledby="assignment-search-title" onClick={event => { if (event.target === event.currentTarget) search.current?.close(); }}>
      <div className={styles.dialogBody}>
        <div className={styles.dialogHeading}><h2 id="assignment-search-title">{t("Search assignments")}</h2><button className={styles.iconButton} aria-label={t("Close search")} onClick={() => search.current?.close()}><WorkspaceIcon name="close" /></button></div>
        <label className={styles.searchInput}><WorkspaceIcon name="search" /><input autoFocus aria-label={t("Search assignments and projects")} placeholder={t("Search assignments and projects")} value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className={styles.searchResults}>
          {filteredProjects.length > 0 && <div className={styles.sectionHeading}>{t("Projects")}</div>}
          {filteredProjects.map(project => <button key={project.id} className={styles.navItem} disabled={props.busy} onClick={() => navigate(() => props.onProject(project))}><WorkspaceIcon name="folder" /><span>{project.name}</span></button>)}
          {filteredAssignments.length > 0 && <div className={styles.sectionHeading}>{t("Assignments")}</div>}
          {filteredAssignments.map(item => <button key={item.id} className={styles.searchResult} disabled={props.busy} onClick={() => navigate(() => props.onOpen(item))}><WorkspaceIcon name="file" /><span>{item.title}<small>{props.data.projects.find(project => project.id === item.projectId)?.name ?? t("Assignment")}</small></span></button>)}
          {!filteredProjects.length && !filteredAssignments.length && <p className={styles.empty}>{props.email ? query.trim() ? t("No results found.") : t("No assignments yet.") : t("Log in to see your assignments.")}</p>}
        </div>
      </div>
    </dialog>
    <dialog ref={create} className={styles.dialog} aria-labelledby="create-project-title" onCancel={event => { if (creating) event.preventDefault(); }}>
      <form className={styles.dialogBody} onSubmit={async event => {
        event.preventDefault(); if (!projectName.trim() || creating) return;
        setCreating(true); setCreateError("");
        try { await props.onCreate(projectName.trim()); create.current?.close(); }
        catch (error) { setCreateError(error instanceof Error ? error.message : t("Could not create project.")); }
        finally { setCreating(false); }
      }}>
        <div className={styles.dialogHeading}><h2 id="create-project-title">{t("New project")}</h2><button type="button" className={styles.iconButton} aria-label={t("Close new project")} disabled={creating} onClick={() => create.current?.close()}><WorkspaceIcon name="close" /></button></div>
        <p className={styles.description}>{t("Keep an assignment’s versions together.")}</p>
        <label className={styles.fieldLabel} htmlFor="project-name">{t("Project name")}</label>
        <input id="project-name" className={styles.textInput} autoFocus required maxLength={80} placeholder={t("e.g. History essay")} value={projectName} disabled={creating} onChange={event => setProjectName(event.target.value)} />
        {createError && <p className={styles.error} role="alert">{t(createError)}</p>}
        <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} disabled={creating} onClick={() => create.current?.close()}>{t("Cancel")}</button><button className={styles.primaryButton} disabled={!projectName.trim() || creating}>{creating ? t("Creating…") : t("Create project")}</button></div>
      </form>
    </dialog>
  </div>;
}
