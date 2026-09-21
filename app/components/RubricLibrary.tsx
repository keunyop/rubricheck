"use client";

import { useEffect, useRef, useState } from "react";
import { RUBRIC_NAME_LIMIT, type SavedRubric, type SavedRubricDetail } from "../../src/lib/rubricLibraryTypes";

const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50";

export function RubricDownloads({ rubric }: { rubric: SavedRubric }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function download(index: number) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/rubrics?id=${rubric.id}&file=${index}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not download this file. Try again.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = rubric.files[index].name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Could not download this file. Try again."); }
    finally { setBusy(false); }
  }
  if (!rubric.files.length) return null;
  return <div className="mt-3 space-y-2">
    <div className="flex flex-wrap gap-2">
      {rubric.files.map((file, index) => <button key={index} type="button" className={button + " max-w-full truncate"} disabled={busy} onClick={() => void download(index)} title={file.name}>
        Download {file.name}
      </button>)}
    </div>
    {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
  </div>;
}

export function RubricLibrary({ onClose, onSelect }: {
  onClose: () => void; onSelect: (rubric: SavedRubricDetail) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const [items, setItems] = useState<SavedRubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    active.current = true;
    const previousFocus = document.activeElement;
    dialog.current?.showModal();
    return () => {
      active.current = false;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/rubrics", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load your rubrics.");
      if (!controller.signal.aborted) setItems(data.rubrics);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load your rubrics.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  async function select(item: SavedRubric) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rubrics?id=" + item.id, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not open this rubric.");
      if (active.current) onSelect(data.rubric);
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : "Could not open this rubric.");
    } finally { if (active.current) setBusy(false); }
  }
  async function change(item: SavedRubric, action: "rename" | "delete") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/rubrics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: item.id, ...(action === "rename" ? { name: name.trim() } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save your changes.");
      if (!active.current) return;
      setItems(current => action === "delete" ? current.filter(row => row.id !== item.id) : current.map(row => row.id === item.id ? { ...row, name: name.trim() } : row));
      setEditing(null); setDeleting(null);
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : "Could not save your changes.");
    } finally { if (active.current) setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="rubric-library-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/30">
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="rubric-library-title" className="text-lg font-semibold">My rubrics</h2>
        <button type="button" autoFocus className={button} onClick={onClose} aria-label="Close rubric library">Close</button>
      </div>
      {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading rubrics…</p> : null}
      {error ? <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}
        <button type="button" className="ml-3 underline" disabled={busy || loading} onClick={() => { setError(""); setLoading(true); setReload(value => value + 1); }}>Retry</button>
      </div> : null}
      {!loading && !error && !items.length ? <p className="py-8 text-center text-sm text-slate-500">Rubrics you use will appear here after a check.</p> : null}
      <ul className="space-y-3">
        {items.map(item => <li key={item.id} className="rounded-xl border border-slate-200 p-4">
          {editing === item.id ? <div className="flex flex-wrap gap-2">
            <input autoFocus aria-label="Rubric name" value={name} onChange={event => setName(event.target.value)} maxLength={RUBRIC_NAME_LIMIT} disabled={busy}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (name.trim()) void change(item, "rename"); } }}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" className={button} disabled={busy || !name.trim()} onClick={() => void change(item, "rename")}>Save</button>
            <button type="button" className={button} disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
          </div> : <div className="flex items-start justify-between gap-3">
            <button type="button" disabled={busy} onClick={() => void select(item)} className="min-w-0 flex-1 text-left disabled:opacity-50">
              <span className="block break-words text-sm font-semibold">{item.name}</span>
              <span className="mt-1 block text-xs text-slate-500">{new Date(item.lastUsedAt).toLocaleDateString()} · {item.files.length ? item.files.length + " file" + (item.files.length > 1 ? "s" : "") : "Text"}</span>
            </button>
            <button type="button" className={button} disabled={busy} onClick={() => { setEditing(item.id); setName(item.name); setDeleting(null); }}>Rename</button>
          </div>}
          <RubricDownloads rubric={item} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" onClick={() => void select(item)}>Use rubric</button>
            {deleting === item.id ? <div className="flex gap-2">
              <button type="button" disabled={busy} className="text-xs text-rose-700" onClick={() => void change(item, "delete")}>Confirm removal</button>
              <button type="button" disabled={busy} className={button} onClick={() => setDeleting(null)}>Cancel</button>
            </div> : <button type="button" disabled={busy} className="text-xs text-slate-500 hover:text-rose-700" onClick={() => { setDeleting(item.id); setEditing(null); }}>Remove</button>}
          </div>
        </li>)}
      </ul>
    </div>
  </dialog>;
}
