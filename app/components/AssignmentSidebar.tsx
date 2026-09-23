"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const mobile = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const create = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDialogElement>(null);

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
  useEffect(() => { search.current?.close(); create.current?.close(); mobile.current?.close(); account.current?.close(); setQuery(""); }, [props.email]);

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
      <button className={styles.iconButton} aria-label="Search assignments" title="Search assignments (Ctrl+K)" onClick={() => { mobile.current?.close(); search.current?.showModal(); }}><WorkspaceIcon name="search" /></button>
      <button className={styles.iconButton} aria-label="Close sidebar" title="Close sidebar" onClick={() => isMobile ? mobile.current?.close() : toggle()}><WorkspaceIcon name="panel" /></button>
    </div>
    <button className={styles.newAssignment} onClick={() => navigate(props.onNew)} disabled={props.busy}><WorkspaceIcon name="new" />New Assignment</button>
    <nav className={styles.sidebarScroll} aria-label="Assignments">
      <div className={styles.sectionHeading}><span>Projects</span><button className={styles.iconButton} aria-label="New project" title="New project" onClick={newProject} disabled={props.busy}><WorkspaceIcon name="plus" /></button></div>
      {props.data.projects.map(project => <button key={project.id} className={styles.navItem} data-active={props.projectId === project.id} onClick={() => navigate(() => props.onProject(project))} disabled={props.busy} title={project.name}>
        <WorkspaceIcon name="folder" /><span>{project.name}</span>
      </button>)}
      {!props.data.projects.length && <button className={styles.mutedItem} onClick={newProject} disabled={props.busy}><WorkspaceIcon name="plus" />New project</button>}
      <div className={styles.sectionHeading}><span>Recents</span></div>
      {props.loading && !props.data.assignments.length ? <p className={styles.empty} role="status">Loading assignments…</p> : null}
      {props.error ? <div className={styles.empty} role="alert">{props.error}<button className={styles.textButton} onClick={props.onRetry}>Try again</button></div> : null}
      {!props.loading && !props.error && !props.data.assignments.length ? <p className={styles.empty}>{props.email ? "Your graded assignments appear here." : "Log in to see your assignments."}</p> : null}
      {props.data.assignments.map(item => <button key={item.id} className={styles.navItem} data-active={props.selectedId === item.id} onClick={() => navigate(() => props.onOpen(item))} disabled={props.busy} title={item.title}><span>{item.title}</span></button>)}
    </nav>
    <div className={styles.sidebarFooter}>
      {props.email ? <button className={styles.accountTrigger} aria-label="Open account menu" aria-haspopup="dialog" onClick={() => account.current?.showModal()}>
        <span className={styles.avatar} aria-hidden="true">{props.email[0].toUpperCase()}</span><span className={styles.email} title={props.email}>{props.email}</span><svg className={styles.accountMore} viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
      </button> : <button className={styles.login} onClick={() => { mobile.current?.close(); props.onLogin(); }}>Log in</button>}
    </div>
  </>;

  return <div className={styles.shell} data-expanded={expanded}>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className={styles.desktopSidebar} aria-label="Sidebar">{content(false)}</aside>
    <div className={styles.content}>
      <div className={styles.openBar}>
        <button className={styles.desktopOpen} aria-label="Open sidebar" title="Open sidebar" onClick={toggle}><WorkspaceIcon name="panel" /></button>
        <button className={styles.mobileOpen} aria-label="Open sidebar" aria-haspopup="dialog" onClick={() => mobile.current?.showModal()}><WorkspaceIcon name="menu" /></button>
      </div>
      {props.children}
    </div>
    <dialog ref={mobile} className={styles.mobileDialog} aria-label="Sidebar" onClick={event => { if (event.target === event.currentTarget) mobile.current?.close(); }}><div className={styles.mobilePanel}>{content(true)}</div></dialog>
    <dialog ref={account} className={styles.accountDialog} aria-label="Account menu" onClick={event => { if (event.target === event.currentTarget) account.current?.close(); }}>
      <div className={styles.accountBody}>
        <div className={styles.accountHeading}><span className={styles.email} title={props.email}>{props.email}</span><button className={styles.iconButton} aria-label="Close account menu" onClick={() => account.current?.close()}><WorkspaceIcon name="close" /></button></div>
        <nav aria-label="Account">
          {props.canAccessAdmin && <Link href="/admin" className={styles.accountItem} onClick={closeAccount}>Admin</Link>}
          <button className={styles.accountItem} onClick={() => { closeAccount(); props.onPricing(); }}>Pricing</button>
          <Link href="/billing/manage" className={styles.accountItem} onClick={closeAccount}>Billing and refunds</Link>
          <button className={`${styles.accountItem} ${styles.logoutItem}`} onClick={() => { closeAccount(); props.onLogout(); }}>Log out</button>
        </nav>
      </div>
    </dialog>
    <dialog ref={search} className={styles.dialog} aria-labelledby="assignment-search-title" onClick={event => { if (event.target === event.currentTarget) search.current?.close(); }}>
      <div className={styles.dialogBody}>
        <div className={styles.dialogHeading}><h2 id="assignment-search-title">Search assignments</h2><button className={styles.iconButton} aria-label="Close search" onClick={() => search.current?.close()}><WorkspaceIcon name="close" /></button></div>
        <label className={styles.searchInput}><WorkspaceIcon name="search" /><input autoFocus aria-label="Search assignments and projects" placeholder="Search assignments and projects" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className={styles.searchResults}>
          {filteredProjects.length > 0 && <div className={styles.sectionHeading}>Projects</div>}
          {filteredProjects.map(project => <button key={project.id} className={styles.navItem} disabled={props.busy} onClick={() => navigate(() => props.onProject(project))}><WorkspaceIcon name="folder" /><span>{project.name}</span></button>)}
          {filteredAssignments.length > 0 && <div className={styles.sectionHeading}>Assignments</div>}
          {filteredAssignments.map(item => <button key={item.id} className={styles.searchResult} disabled={props.busy} onClick={() => navigate(() => props.onOpen(item))}><WorkspaceIcon name="file" /><span>{item.title}<small>{props.data.projects.find(project => project.id === item.projectId)?.name ?? "Assignment"}</small></span></button>)}
          {!filteredProjects.length && !filteredAssignments.length && <p className={styles.empty}>{props.email ? query.trim() ? "No results found." : "No assignments yet." : "Log in to see your assignments."}</p>}
        </div>
      </div>
    </dialog>
    <dialog ref={create} className={styles.dialog} aria-labelledby="create-project-title" onCancel={event => { if (creating) event.preventDefault(); }}>
      <form className={styles.dialogBody} onSubmit={async event => {
        event.preventDefault(); if (!projectName.trim() || creating) return;
        setCreating(true); setCreateError("");
        try { await props.onCreate(projectName.trim()); create.current?.close(); }
        catch (error) { setCreateError(error instanceof Error ? error.message : "Could not create project."); }
        finally { setCreating(false); }
      }}>
        <div className={styles.dialogHeading}><h2 id="create-project-title">New project</h2><button type="button" className={styles.iconButton} aria-label="Close new project" disabled={creating} onClick={() => create.current?.close()}><WorkspaceIcon name="close" /></button></div>
        <p className={styles.description}>Keep an assignment’s versions together.</p>
        <label className={styles.fieldLabel} htmlFor="project-name">Project name</label>
        <input id="project-name" className={styles.textInput} autoFocus required maxLength={80} placeholder="e.g. History essay" value={projectName} disabled={creating} onChange={event => setProjectName(event.target.value)} />
        {createError && <p className={styles.error} role="alert">{createError}</p>}
        <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} disabled={creating} onClick={() => create.current?.close()}>Cancel</button><button className={styles.primaryButton} disabled={!projectName.trim() || creating}>{creating ? "Creating…" : "Create project"}</button></div>
      </form>
    </dialog>
  </div>;
}
