"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "../components/LanguageProvider";
import { LANGUAGE_NAMES, LOCALES, type Locale } from "../../src/i18n/config";
import { QUIZ_LIMITS, type QuizSource, type QuizLibrary, type QuizSettings, type QuizDetail, type QuizJob } from "../../src/lib/quizTypes";
import type { AssignmentWorkspace } from "../../src/lib/assignmentWorkspaceTypes";
import { quizFetch, quizErrorMessage } from "../../src/lib/quizClient";
import styles from "./quiz.module.css";

type SourceEntry = { id: string; name: string; source: QuizSource | null; units: number[]; error: string };
type PendingFile = { id: string; file: File; range: string; error: string };
export function QuizCreator({ library, workspace, assignment, trial = false, reuse, retryJob }: { library: QuizLibrary; workspace: AssignmentWorkspace; assignment: string | null; trial?: boolean; reuse: string | null; retryJob?: QuizJob }) {
  const { t, href, resultLanguage, siteLanguage } = useLanguage(), router = useRouter();
  const [tab, setTab] = useState("upload"), [sources, setSources] = useState<SourceEntry[]>([]), [files, setFiles] = useState<PendingFile[]>([]);
  const [text, setText] = useState(""), [sourceName, setSourceName] = useState(""), [assignmentId, setAssignmentId] = useState("");
  const [settings, setSettings] = useState<QuizSettings>(retryJob?.settings ?? { title: "", projectId: null, count: library.access.pro ? 10 : Math.min(10, library.access.remaining), language: resultLanguage, difficulty: "standard", purpose: "concepts", topic: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [loading, setLoading] = useState(Boolean(assignment || trial || reuse || retryJob));
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const initial = useRef({ retryJob, maximum: library.access.pro ? 20 : library.access.remaining, projectIds: workspace.projects.map(p => p.id) });
  const maximum = library.access.pro ? 20 : library.access.remaining;
  const selectedCharacters = sources.reduce((sum, s) => sum + (s.source?.segments.filter(p => s.units.includes(p.unit)).reduce((n, p) => n + p.text.length, 0) ?? 0), 0);
  const selectedUnits = sources.reduce((sum, s) => sum + (s.source?.unitKind === "paragraph" ? 0 : s.units.length), 0);
  const hasAssignment = sources.some(s => s.source?.kind === "assignment"), hasImprovements = sources.some(s => s.source?.feedback?.length);
  const expired = sources.some(s => !s.source || s.source.expiresAt <= Date.now());
  const activeJob = library.jobs.find(j => !["failed", "completed"].includes(j.status));

  useEffect(() => {
    const { retryJob, maximum, projectIds } = initial.current;
    let live = true;
    async function load() {
      try {
        if (assignment || trial) {
          // The existing claim endpoint binds the guest result to this verified
          // account without regrading or extending the original source TTL.
          const id = assignment ?? (await quizFetch<{ result: { evaluation_id: string } }>("/api/trial", {})).result.evaluation_id;
          const { source } = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources", { action: "assignment", id });
          if (!live) return;
          setSources([{ id: source.id, name: source.name, source, units: source.segments.map(s => s.unit), error: "" }]);
          setSettings(s => ({ ...s, title: source.name, projectId: source.projectId }));
        } else if (reuse || retryJob) {
          const previous = reuse ? (await quizFetch<QuizDetail>("/api/quizzes?id=" + reuse)).quiz : retryJob!;
          const entries = await Promise.all(previous.sources.map(async ref => {
            try { const { source } = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources?id=" + ref.id); return { id: ref.id, name: ref.name, source, units: ref.units, error: "" }; }
            catch (error) { return { id: ref.id, name: ref.name, source: null, units: ref.units, error: quizErrorMessage(error) }; }
          }));
          if (live) {
            const settings = "title" in previous ? { ...previous.settings, title: previous.title, projectId: previous.projectId } : previous.settings;
            setSources(entries);
            setSettings({ ...settings, projectId: settings.projectId && projectIds.includes(settings.projectId) ? settings.projectId : null, count: Math.min(settings.count, maximum) });
          }
        }
      } catch (error) { if (live) setError(quizErrorMessage(error)); }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; };
  }, [assignment, trial, reuse]);

  function addSource(source: QuizSource) {
    setSources(previous => [...previous, { id: source.id, name: source.name, source, units: source.segments.map(s => s.unit), error: "" }]);
    setSettings(s => ({ ...s, title: s.title || source.name, projectId: s.projectId ?? source.projectId }));
  }
  async function addTextOrAssignment(body: object) {
    setBusy(true); setError("");
    try { if (sources.length + files.length >= 5) throw new Error("QUIZ_INVALID_SOURCES"); const { source } = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources", body); addSource(source); setText(""); setAssignmentId(""); }
    catch (error) { setError(quizErrorMessage(error)); } finally { setBusy(false); }
  }
  function addFiles(incoming: File[]) {
    const total = incoming.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.file.size, 0) + sources.reduce((n, s) => n + (s.source?.bytes ?? 0), 0);
    if (sources.length + files.length + incoming.length > 5) { setError(quizErrorMessage(new Error("QUIZ_INVALID_SOURCES"))); return; }
    if (total > QUIZ_LIMITS.totalBytes) { setError(quizErrorMessage(new Error("QUIZ_SOURCE_LIMIT"))); return; }
    setFiles(previous => [...previous, ...incoming.map(file => ({ id: crypto.randomUUID(), file, range: "", error: file.size > QUIZ_LIMITS.fileBytes ? quizErrorMessage(new Error("QUIZ_FILE_LIMIT")) : "" }))]);
  }
  async function processFile(entry: PendingFile) {
    setBusy(true); setError("");
    try {
      const upload = await quizFetch<{ uploadId: string; chunkBytes: number }>("/api/quizzes/sources", { action: "upload", name: entry.file.name, size: entry.file.size, range: entry.range });
      for (let offset = 0, index = 0; offset < entry.file.size; offset += upload.chunkBytes, index++) {
        const response = await fetch(`/api/quizzes/sources?id=${upload.uploadId}&index=${index}`, { method: "PUT", body: entry.file.slice(offset, offset + upload.chunkBytes) });
        if (!response.ok) throw new Error((await response.json()).code);
      }
      const { source } = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources", { action: "extract", id: upload.uploadId });
      addSource(source); setFiles(previous => previous.filter(f => f.id !== entry.id));
    } catch (error) { setFiles(previous => previous.map(f => f.id === entry.id ? { ...f, error: quizErrorMessage(error) } : f)); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError("");
    try {
      const payload = { settings, sources: sources.map(s => ({ id: s.id, units: s.units })) };
      const fingerprint = JSON.stringify(payload);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const { job } = await quizFetch<{ job: QuizJob }>("/api/quizzes", { ...payload, requestId: request.current.id });
      router.push(href("/quizzes?job=" + job.id));
    } catch (error) { setError(quizErrorMessage(error)); } finally { setBusy(false); }
  }
  return <>
    <header className={styles.header}><h1>{t("Create a quiz")}</h1></header>
    {loading && <p role="status">{t("Checking materials…")}</p>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
    {activeJob && <div className={styles.notice}><Link href={href("/quizzes?job=" + activeJob.id)}>{t("A task is already running. Open My quizzes to check it.")}</Link></div>}
    <div className={styles.form}>
      <section className={styles.section}><h2>{t("1. Study materials")}</h2>
        <p className={styles.muted}>{t("Up to 5 sources · 20 MB per file · 50 MB total")}</p>
        <div className={styles.tabs}>{[["upload", "Upload materials"], ["assignment", "Graded assignment"], ["text", "Paste text"]].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{t(label)}</button>)}</div>
        {tab === "upload" && <div className={styles.card} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) addFiles(Array.from(e.dataTransfer.files)); }}><label className={styles.field}>{t("Choose files")}<input type="file" accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg" multiple disabled={busy || loading} onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} /></label><p className={styles.muted}>PDF · DOCX · PPTX · TXT · PNG · JPG</p></div>}
        {tab === "assignment" && <div className={styles.row}><select aria-label={t("Graded assignment")} value={assignmentId} onChange={e => setAssignmentId(e.target.value)} disabled={hasAssignment}><option value="">{t("Select an assignment")}</option>{workspace.assignments.map(a => <option key={a.id} value={a.id}>{a.title} · {new Date(a.createdAt).toLocaleDateString(siteLanguage)}</option>)}</select><button className={styles.secondary} disabled={busy || !assignmentId || hasAssignment} onClick={() => void addTextOrAssignment({ action: "assignment", id: assignmentId })}>{t("Add source")}</button></div>}
        {tab === "text" && <div className={styles.card}><label className={styles.field}>{t("Source name")}<input value={sourceName} maxLength={200} onChange={e => setSourceName(e.target.value)} /></label><label className={styles.field}>{t("Paste text")}<textarea value={text} maxLength={50_000} onChange={e => setText(e.target.value)} /></label><button className={styles.secondary} disabled={busy || text.trim().length < 20} onClick={() => void addTextOrAssignment({ action: "text", name: sourceName.trim() || t("Pasted text"), text })}>{t("Add source")}</button></div>}
        {files.map(entry => <div className={styles.card} key={entry.id}><h3>{entry.file.name}</h3><label className={styles.field}>{t("Pages, slides or paragraphs (optional)")}<input value={entry.range} placeholder="1-5, 8" onChange={e => setFiles(previous => previous.map(f => f.id === entry.id ? { ...f, range: e.target.value } : f))} /></label>{entry.error && <p role="alert" className={styles.error}>{t(entry.error)}</p>}<div className={styles.actions}><button className={styles.secondary} disabled={busy || entry.file.size > QUIZ_LIMITS.fileBytes} onClick={() => void processFile(entry)}>{t("Read source")}</button><button className={styles.link} disabled={busy} onClick={() => setFiles(previous => previous.filter(f => f.id !== entry.id))}>{t("Remove")}</button></div></div>)}
      </section>
      <section className={styles.section}><h2>{t("2. Question scope")}</h2>
        {sources.map(entry => <div className={styles.card} key={entry.id}><div className={styles.header}><h3>{entry.name}</h3><button className={styles.link} disabled={busy} onClick={() => setSources(previous => previous.filter(s => s.id !== entry.id))}>{t("Remove")}</button></div>{entry.error && <p className={styles.error}>{t(entry.error)}</p>}{entry.source && <><p className={styles.muted}>{t(entry.source.unitKind)}: {entry.units.join(", ")} · {t("Available until")} {new Date(entry.source.expiresAt).toLocaleString(siteLanguage)}</p><details><summary>{t("Preview and select scope")}</summary><div className={styles.actions}><button className={styles.link} onClick={() => setSources(previous => previous.map(s => s.id === entry.id ? { ...s, units: s.source!.segments.map(p => p.unit) } : s))}>{t("Select all")}</button><button className={styles.link} onClick={() => setSources(previous => previous.map(s => s.id === entry.id ? { ...s, units: [] } : s))}>{t("Clear selection")}</button></div><div className={styles.preview}>{entry.source.segments.map(segment => <label className={styles.segment} key={segment.unit}><input type="checkbox" checked={entry.units.includes(segment.unit)} onChange={e => setSources(previous => previous.map(s => s.id === entry.id ? { ...s, units: e.target.checked ? [...s.units, segment.unit].sort((a, b) => a - b) : s.units.filter(n => n !== segment.unit) } : s))} /><span className={styles.sourceText}><strong>{t(entry.source!.unitKind)} {segment.unit}</strong><br />{segment.text}</span></label>)}</div></details></>}</div>)}
        <p className={styles.muted}>{t("{units}/50 pages or slides · {characters}/50,000 characters", { units: selectedUnits, characters: selectedCharacters.toLocaleString(siteLanguage) })}</p>
        {sources.length > 0 && <p className={styles.muted}>{t("Sources expire after their retention period. Saved quizzes remain available; new questions need valid sources.")}</p>}
      </section>
      <section className={styles.section}><h2>{t("3. Question settings")}</h2>
        <div className={styles.grid}>
          <label className={styles.field}>{t("Purpose")}<select aria-label={t("Purpose")} value={settings.purpose} onChange={e => setSettings(s => ({ ...s, purpose: e.target.value as QuizSettings["purpose"] }))}><option value="concepts">{t("Core concepts")}</option>{hasImprovements && <option value="improvements">{t("Grading improvement topics")}</option>}<option value="topic">{t("Selected topic")}</option></select></label>
          {settings.purpose === "topic" && <label className={styles.field}>{t("Selected topic")}<input maxLength={300} value={settings.topic} onChange={e => setSettings(s => ({ ...s, topic: e.target.value }))} /></label>}
          <label className={styles.field}>{t("Question count")}<select aria-label={t("Question count")} value={settings.count} onChange={e => setSettings(s => ({ ...s, count: Number(e.target.value) }))}>{maximum === 0 && <option value="0">0</option>}{Array.from({ length: maximum }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className={styles.field}>{t("Difficulty")}<select aria-label={t("Difficulty")} value={settings.difficulty} onChange={e => setSettings(s => ({ ...s, difficulty: e.target.value as QuizSettings["difficulty"] }))}>{[["basic", "Basic"], ["standard", "Standard"], ["advanced", "Advanced"]].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label className={styles.field}>{t("Question language")}<select aria-label={t("Question language")} value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value as Locale }))}>{LOCALES.map(locale => <option key={locale} value={locale}>{LANGUAGE_NAMES[locale]}</option>)}</select></label>
          <label className={styles.field}>{t("Quiz title")}<input maxLength={120} value={settings.title} onChange={e => setSettings(s => ({ ...s, title: e.target.value }))} /></label>
          <label className={styles.field}>{t("Project")}<select aria-label={t("Project")} value={settings.projectId ?? ""} onChange={e => setSettings(s => ({ ...s, projectId: e.target.value || null }))}><option value="">{t("No project")}</option>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        </div><p className={styles.muted}>{t("Multiple choice + true/false · Up to 20 questions per request")}</p>
      </section>
      <div className={styles.footer}><p className={styles.muted}>{t(library.access.pro ? "Pro · No monthly generation limit" : "{count} free questions remaining / 10 total", { count: library.access.remaining })}</p>{maximum === 0 ? <Link className={styles.primary} href={href("/pricing")}>{t("Continue with Pro")}</Link> : <button className={styles.primary} disabled={busy || loading || Boolean(activeJob) || expired || !sources.length || files.length > 0 || sources.some(s => !s.units.length) || selectedUnits > 50 || selectedCharacters > 50_000 || selectedCharacters < 20 || !settings.title.trim() || settings.count < 1 || settings.count > maximum || (settings.purpose === "topic" && !settings.topic.trim())} onClick={() => void generate()}>{t(busy ? "Checking materials…" : "Generate quiz")}</button>}</div>
    </div>
  </>;
}
