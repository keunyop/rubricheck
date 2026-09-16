"use client";

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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const deletion = useRef<HTMLDialogElement>(null);
  const versions = projectVersions(assignments, project.id);

  return <section className={styles.projectView} aria-label="Project">
    <div className={styles.projectHeading}>
      <div className={styles.projectTitle}><span className={styles.projectIcon}><WorkspaceIcon name="folder" /></span>
        {editing ? <form className={styles.renameForm} onSubmit={async event => {
          event.preventDefault(); setSaving(true); setError("");
          try { await onRename(name.trim()); setEditing(false); } catch (error) { setError(error instanceof Error ? error.message : "Could not rename project."); } finally { setSaving(false); }
        }}><input autoFocus aria-label="Project name" className={styles.textInput} maxLength={80} required value={name} onChange={event => setName(event.target.value)} /><button className={styles.secondaryButton} disabled={saving || !name.trim()}>Save</button><button type="button" className={styles.iconButton} aria-label="Cancel rename" onClick={() => setEditing(false)}><WorkspaceIcon name="close" /></button></form> : <h1>{project.name}</h1>}
      </div>
      <div className={styles.projectActions}><button className={styles.textButton} disabled={busy || saving} onClick={() => { setName(project.name); setEditing(true); }}>Rename</button><button className={styles.textButton} disabled={busy || saving} onClick={() => deletion.current?.showModal()}>Delete</button></div>
    </div>
    <p className={styles.description}>One assignment. Every version.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.versionsHeader}><h2>Versions <span>{versions.length}</span></h2><button className={styles.primaryButton} disabled={busy} onClick={onNewVersion}><WorkspaceIcon name="plus" />New version</button></div>
    {versions.length ? <div className={styles.versionList}>{[...versions].reverse().map((item, index) => <button key={item.id} className={styles.versionRow} disabled={busy} onClick={() => onOpen(item)}>
      <span className={styles.versionBadge}>V{versions.length - index}</span>
      <span className={styles.versionName}>{item.title}<small>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {item.mode === "strict" ? "Strict" : "Standard"}</small></span>
      <span className={styles.versionScore}>{item.overallRange[0]}–{item.overallRange[1]}<small>/ 100</small></span>
    </button>)}</div> : <div className={styles.projectEmpty}><WorkspaceIcon name="file" /><h3>No versions yet</h3><p>Grade your first draft or move an assignment into this project.</p><button className={styles.secondaryButton} onClick={onNewVersion} disabled={busy}>Grade a draft</button></div>}
    <dialog ref={deletion} className={styles.dialog} aria-labelledby="delete-project-title" onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className={styles.dialogBody}><h2 id="delete-project-title" className={styles.dialogHeading}>Delete project?</h2><p className={styles.description}>Your assignments will stay in Recents.</p>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.dialogActions}><button className={styles.secondaryButton} disabled={saving} onClick={() => deletion.current?.close()}>Cancel</button><button className={styles.primaryButton} disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await onDelete(); } catch (error) { setError(error instanceof Error ? error.message : "Could not delete project."); } finally { setSaving(false); } }}>{saving ? "Deleting…" : "Delete project"}</button></div></div>
    </dialog>
  </section>;
}
