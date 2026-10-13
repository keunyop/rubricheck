"use client";
import { useLanguage } from "./LanguageProvider";


import { useRef, useState } from "react";
import { projectVersions, type AssignmentHistoryItem, type AssignmentProject } from "../../src/lib/assignmentWorkspaceTypes";
import { WorkspaceIcon } from "./AssignmentSidebar";
import styles from "./assignmentWorkspace.module.css";

export function AssignmentProjectView({ project, assignments, busy, onOpen, onNewVersion, onRename, onDelete }: {
  project: AssignmentProject;
  assignments: AssignmentHistoryItem[];
  busy: boolean;
  onOpen: (item: AssignmentHistoryItem) => void;
  onNewVersion: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t, siteLanguage } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const deletion = useRef<HTMLDialogElement>(null);
  const versions = projectVersions(assignments, project.id);

  return <section className={styles.projectView} aria-label={t("Project")}>
    <div className={styles.projectHeading}>
      <div className={styles.projectTitle}><span className={styles.projectIcon}><WorkspaceIcon name="folder" /></span>
        {editing ? <form className={styles.renameForm} onSubmit={async event => {
          event.preventDefault(); setSaving(true); setError("");
          try { await onRename(name.trim()); setEditing(false); } catch (error) { setError(error instanceof Error ? error.message : t("Could not rename project.")); } finally { setSaving(false); }
        }}><input autoFocus aria-label={t("Project name")} className={styles.textInput} maxLength={80} required value={name} onChange={event => setName(event.target.value)} /><button className={styles.secondaryButton} disabled={saving || !name.trim()}>{t("Save")}</button><button type="button" className={styles.iconButton} aria-label={t("Cancel rename")} onClick={() => setEditing(false)}><WorkspaceIcon name="close" /></button></form> : <h1>{project.name}</h1>}
      </div>
      <div className={styles.projectActions}><button className={styles.textButton} disabled={busy || saving} onClick={() => { setName(project.name); setEditing(true); }}>{t("Rename")}</button><button className={styles.textButton} disabled={busy || saving} onClick={() => deletion.current?.showModal()}>{t("Delete")}</button></div>
    </div>
    <p className={styles.description}>{t("One assignment. Every version.")}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.versionsHeader}><h2>{t("Versions")} <span>{versions.length}</span></h2><button className={styles.primaryButton} disabled={busy} onClick={onNewVersion}><WorkspaceIcon name="plus" />{t("New version")}</button></div>
    {versions.length ? <div className={styles.versionList}>{[...versions].reverse().map((item, index) => <button key={item.id} className={styles.versionRow} disabled={busy} onClick={() => onOpen(item)}>
      <span className={styles.versionBadge}>V{versions.length - index}</span>
      <span className={styles.versionName}>{item.title}<small>{new Date(item.createdAt).toLocaleDateString(siteLanguage, { month: "short", day: "numeric", year: "numeric" })} · {item.mode === "strict" ? t("Strict") : t("Standard")}</small></span>
      <span className={styles.versionScore}>{item.overallRange[0]}–{item.overallRange[1]}<small>/ 100</small></span>
    </button>)}</div> : <div className={styles.projectEmpty}><WorkspaceIcon name="file" /><h3>{t("No versions yet")}</h3><p>{t("Grade your first draft or move an assignment into this project.")}</p><button className={styles.secondaryButton} onClick={onNewVersion} disabled={busy}>{t("Grade a draft")}</button></div>}
    <dialog ref={deletion} className={styles.dialog} aria-labelledby="delete-project-title" onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className={styles.dialogBody}><h2 id="delete-project-title" className={styles.dialogHeading}>{t("Delete project?")}</h2><p className={styles.description}>{t("Your assignments will stay in Recents.")}</p>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.dialogActions}><button className={styles.secondaryButton} disabled={saving} onClick={() => deletion.current?.close()}>{t("Cancel")}</button><button className={styles.primaryButton} disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await onDelete(); } catch (error) { setError(error instanceof Error ? error.message : t("Could not delete project.")); } finally { setSaving(false); } }}>{saving ? t("Deleting…") : t("Delete project")}</button></div></div>
    </dialog>
  </section>;
}
