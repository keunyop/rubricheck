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
  const [tab, setTab] = useState(assignment || trial ? "assignment" : "upload"), [sources, setSources] = useState<SourceEntry[]>([]), [files, setFiles] = useState<PendingFile[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const actionLock = useRef(false);
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
          setSettings(s => ({ ...s, title: source.name.slice(0, 120), projectId: source.projectId }));
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
    setSettings(s => ({ ...s, title: s.title || source.name.slice(0, 120), projectId: s.projectId ?? source.projectId }));
  }
  async function addAssignment() {
    if (actionLock.current || loading || !assignmentId || hasAssignment) return;
    actionLock.current = true; setBusy(true); setError("");
    try { if (sources.length + files.length >= 5) throw new Error("QUIZ_INVALID_SOURCES"); const { source } = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources", { action: "assignment", id: assignmentId }); addSource(source); setAssignmentId(""); }
    catch (error) { setError(quizErrorMessage(error)); } finally { actionLock.current = false; setBusy(false); }
  }
  function addFiles(incoming: File[]) {
    if (actionLock.current || loading || !incoming.length) return;
    setError("");
    const total = incoming.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.file.size, 0) + sources.reduce((n, s) => n + (s.source?.bytes ?? 0), 0);
    if (sources.length + files.length + incoming.length > 5) { setError(quizErrorMessage(new Error("QUIZ_INVALID_SOURCES"))); return; }
    if (total > QUIZ_LIMITS.totalBytes) { setError(quizErrorMessage(new Error("QUIZ_SOURCE_LIMIT"))); return; }
    setFiles(previous => [...previous, ...incoming.map(file => ({ id: crypto.randomUUID(), file, range: "", error: file.size > QUIZ_LIMITS.fileBytes ? quizErrorMessage(new Error("QUIZ_FILE_LIMIT")) : !/\.(pdf|docx|pptx|txt|png|jpe?g)$/i.test(file.name) ? quizErrorMessage(new Error("QUIZ_FILE_TYPE")) : "" }))]);
  }
  async function processFile(entry: PendingFile) {
    if (actionLock.current || loading) return;
    actionLock.current = true; setBusy(true); setError("");
    try {
      const upload = await quizFetch<{ uploadId: string; chunkBytes: number }>("/api/quizzes/sources", { action: "upload", name: entry.file.name, size: entry.file.size, range: entry.range });
      for (let offset = 0, index = 0; offset < entry.file.size; offset += upload.chunkBytes, index++) {
        const response = await fetch(`/api/quizzes/sources?id=${upload.uploadId}&index=${index}`, { method: "PUT", body: entry.file.slice(offset, offset + upload.chunkBytes) });
        if (!response.ok) throw new Error((await response.json()).code);
      }
      const { source } = await quizFetch<{ source: QuizSource }>("/api/quizzes/sources", { action: "extract", id: upload.uploadId });
      addSource(source); setFiles(previous => previous.filter(f => f.id !== entry.id));
    } catch (error) { setFiles(previous => previous.map(f => f.id === entry.id ? { ...f, error: quizErrorMessage(error) } : f)); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function generate() {
    if (actionLock.current || loading || !canGenerate) return;
    actionLock.current = true; setBusy(true); setError("");
    try {
      const payload = { settings: { ...settings, purpose: effectivePurpose }, sources: sources.map(s => ({ id: s.id, units: s.units })) };
      const fingerprint = JSON.stringify(payload);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const { job } = await quizFetch<{ job: QuizJob }>("/api/quizzes", { ...payload, requestId: request.current.id });
      router.push(href("/quizzes?job=" + job.id));
    } catch (error) { setError(quizErrorMessage(error)); } finally { actionLock.current = false; setBusy(false); }
  }
  const effectivePurpose = settings.purpose === "improvements" && !hasImprovements ? "concepts" : settings.purpose;
  const canGenerate = !activeJob && !expired && sources.length > 0 && files.length === 0
    && sources.every(s => s.units.length > 0) && selectedUnits <= QUIZ_LIMITS.units
    && selectedCharacters <= QUIZ_LIMITS.characters && selectedCharacters >= 20
    && settings.title.trim().length > 0 && Number.isInteger(settings.count)
    && settings.count >= 1 && settings.count <= maximum
    && (effectivePurpose !== "topic" || settings.topic.trim().length > 0);
  const unavailable = busy || loading;
  return <>
    <header className={styles.header}><h1>{t("Create a quiz")}</h1></header>
    {loading && <p role="status" className={styles.muted}>{t("Checking materials…")}</p>}
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
    {activeJob && <div className={styles.notice}><Link href={href("/quizzes?job=" + activeJob.id)}>{t("A task is already running. Open My quizzes to check it.")}</Link></div>}
    <div className={`${styles.form} ${styles.creator}`}>
      <section className={styles.creatorSection} aria-labelledby="quiz-materials-title">
        <div className={styles.sectionTitle}><span className={styles.step} aria-hidden="true">1</span><h2 id="quiz-materials-title">{t("Study materials")}</h2></div>
        <div className={styles.sourceTabs} role="group" aria-label={t("Study materials")}>
          {[["upload", "Upload materials"], ["assignment", "Graded assignment"]].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} disabled={unavailable}>{t(label)}</button>)}
        </div>
        {tab === "upload" && <>
          <input ref={fileInput} className={styles.hiddenInput} type="file" aria-label={t("Choose files")} accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg" multiple disabled={unavailable} onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          <div className={styles.dropzone} data-dragging={dragging} data-disabled={unavailable}
            onDragEnter={e => { e.preventDefault(); if (!unavailable) { dragDepth.current++; setDragging(true); } }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = unavailable ? "none" : "copy"; }}
            onDragLeave={e => { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
            onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); if (!unavailable) addFiles(Array.from(e.dataTransfer.files)); }}>
            <svg className={styles.uploadIcon} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
            <p>{t("Drag and drop a file here")}</p>
            <p className={styles.formats}>{t("PDF, DOCX, PPTX, TXT or images · Up to 20 MB each")}</p>
            <button type="button" className={styles.secondary} disabled={unavailable} onClick={() => fileInput.current?.click()}>{t("Choose files")}</button>
          </div>
        </>}
        {tab === "assignment" && !hasAssignment && <div className={styles.assignmentPicker}>
          <select aria-label={t("Graded assignment")} value={assignmentId} onChange={e => setAssignmentId(e.target.value)} disabled={unavailable || hasAssignment}><option value="">{t("Select an assignment")}</option>{workspace.assignments.map(a => <option key={a.id} value={a.id}>{a.title} · {new Date(a.createdAt).toLocaleDateString(siteLanguage)}</option>)}</select>
          <button className={styles.secondary} disabled={unavailable || !assignmentId || hasAssignment} onClick={() => void addAssignment()}>{t("Add source")}</button>
          {!workspace.assignments.length && <p className={styles.muted}>{t("No assignments yet.")}</p>}
        </div>}
        {files.map(entry => <div className={styles.sourceCard} key={entry.id}>
          <div className={styles.sourceHeading}><h3>{entry.file.name}</h3><button className={styles.link} disabled={unavailable} onClick={() => setFiles(previous => previous.filter(f => f.id !== entry.id))}>{t("Remove")}</button></div>
          <details className={styles.sourceDetails}>
            <summary>{t("Pages, slides or paragraphs (optional)")}</summary>
            <label className={styles.field}><span className={styles.srOnly}>{t("Pages, slides or paragraphs (optional)")}</span><input value={entry.range} placeholder="1-5, 8" disabled={unavailable} onChange={e => setFiles(previous => previous.map(f => f.id === entry.id ? { ...f, range: e.target.value, error: "" } : f))} /></label>
          </details>
          {entry.error && <p role="alert" className={styles.error}>{t(entry.error)}</p>}
          <div><button className={styles.secondary} disabled={unavailable || entry.file.size > QUIZ_LIMITS.fileBytes || !/\.(pdf|docx|pptx|txt|png|jpe?g)$/i.test(entry.file.name)} onClick={() => void processFile(entry)}>{t("Read source")}</button></div>
        </div>)}
        {sources.map(entry => <div className={styles.sourceCard} key={entry.id}>
          <div className={styles.sourceHeading}><h3>{entry.name}</h3><button className={styles.link} disabled={unavailable} onClick={() => setSources(previous => previous.filter(s => s.id !== entry.id))}>{t("Remove")}</button></div>
          {entry.error && <p className={styles.error} role="alert">{t(entry.error)}</p>}
          {entry.source && <>
            <p className={styles.sourceStatus}>{entry.units.length === entry.source.segments.length ? t("All content selected") : `${t(entry.source.unitKind)}: ${entry.units.join(", ") || "0"}`}</p>
            <details className={styles.sourceDetails}>
              <summary>{t("Preview and select scope")}</summary>
              <div className={styles.actions}><button className={styles.link} disabled={unavailable} onClick={() => setSources(previous => previous.map(s => s.id === entry.id ? { ...s, units: s.source!.segments.map(p => p.unit) } : s))}>{t("Select all")}</button><button className={styles.link} disabled={unavailable} onClick={() => setSources(previous => previous.map(s => s.id === entry.id ? { ...s, units: [] } : s))}>{t("Clear selection")}</button></div>
              <div className={styles.preview}>{entry.source.segments.map(segment => <label className={styles.segment} key={segment.unit}><input type="checkbox" checked={entry.units.includes(segment.unit)} disabled={unavailable} onChange={e => setSources(previous => previous.map(s => s.id === entry.id ? { ...s, units: e.target.checked ? [...s.units, segment.unit].sort((a, b) => a - b) : s.units.filter(n => n !== segment.unit) } : s))} /><span className={styles.sourceText}><strong>{t(entry.source!.unitKind)} {segment.unit}</strong><br />{segment.text}</span></label>)}</div>
              <p className={styles.muted}>{t("Available until")} {new Date(entry.source.expiresAt).toLocaleString(siteLanguage)}</p>
            </details>
          </>}
        </div>)}
        {sources.length > 0 ? <p className={selectedUnits > QUIZ_LIMITS.units || selectedCharacters > QUIZ_LIMITS.characters ? styles.error : styles.muted}>{t("{units}/50 pages or slides · {characters}/50,000 characters", { units: selectedUnits, characters: selectedCharacters.toLocaleString(siteLanguage) })}</p> : <p className={styles.muted}>{t("Up to 5 sources · 20 MB per file · 50 MB total")}</p>}
      </section>
      <section className={styles.creatorSection} aria-labelledby="quiz-count-title">
        <div className={styles.countRow}>
          <div className={styles.sectionTitle}><span className={styles.step} aria-hidden="true">2</span><h2 id="quiz-count-title">{t("Question count")}</h2></div>
          <div className={styles.stepper}>
            <button type="button" aria-label={t("Fewer questions")} disabled={unavailable || settings.count <= 1 || maximum === 0} onClick={() => setSettings(s => ({ ...s, count: Math.max(1, s.count - 1) }))}>−</button>
            <input type="number" aria-label={t("Question count")} min={maximum ? 1 : 0} max={maximum} step={1} inputMode="numeric" value={settings.count || ""} placeholder="0" disabled={unavailable || maximum === 0} onChange={e => setSettings(s => ({ ...s, count: e.target.value === "" ? 0 : Number(e.target.value) }))} onBlur={() => setSettings(s => ({ ...s, count: maximum ? Math.min(maximum, Math.max(1, Math.round(s.count || 1))) : 0 }))} />
            <button type="button" aria-label={t("More questions")} disabled={unavailable || settings.count >= maximum} onClick={() => setSettings(s => ({ ...s, count: Math.min(maximum, s.count + 1) }))}>+</button>
          </div>
        </div>
        <p className={styles.muted}>{t("Multiple choice + true/false · Up to 20 questions per request")}</p>
        <details className={styles.advanced}>
          <summary aria-label={t("Advanced settings")}><span>{t("Advanced settings")}</span><span className={styles.settingsHint}>{t(settings.difficulty === "basic" ? "Basic" : settings.difficulty === "advanced" ? "Advanced" : "Standard")} · {LANGUAGE_NAMES[settings.language]}</span></summary>
          <fieldset disabled={unavailable} className={styles.grid}>
            <label className={styles.field}>{t("Quiz title")}<input maxLength={120} value={settings.title} onChange={e => setSettings(s => ({ ...s, title: e.target.value }))} /></label>
            <label className={styles.field}>{t("Project")}<select aria-label={t("Project")} value={settings.projectId ?? ""} onChange={e => setSettings(s => ({ ...s, projectId: e.target.value || null }))}><option value="">{t("No project")}</option>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className={styles.field}>{t("Difficulty")}<select aria-label={t("Difficulty")} value={settings.difficulty} onChange={e => setSettings(s => ({ ...s, difficulty: e.target.value as QuizSettings["difficulty"] }))}>{[["basic", "Basic"], ["standard", "Standard"], ["advanced", "Advanced"]].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
            <label className={styles.field}>{t("Question language")}<select aria-label={t("Question language")} value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value as Locale }))}>{LOCALES.map(locale => <option key={locale} value={locale}>{LANGUAGE_NAMES[locale]}</option>)}</select></label>
            <label className={styles.field}>{t("Purpose")}<select aria-label={t("Purpose")} value={effectivePurpose} onChange={e => setSettings(s => ({ ...s, purpose: e.target.value as QuizSettings["purpose"] }))}><option value="concepts">{t("Core concepts")}</option>{hasImprovements && <option value="improvements">{t("Grading improvement topics")}</option>}<option value="topic">{t("Selected topic")}</option></select></label>
            {effectivePurpose === "topic" && <label className={styles.field}>{t("Selected topic")}<input maxLength={300} value={settings.topic} onChange={e => setSettings(s => ({ ...s, topic: e.target.value }))} /></label>}
          </fieldset>
        </details>
      </section>
      <div className={`${styles.footer} ${styles.creatorFooter}`}>
        <p className={styles.muted} role={busy ? "status" : undefined}>{t(busy ? "Checking materials…" : library.access.pro ? "Pro · No monthly generation limit" : "{count} free questions remaining / 10 total", { count: library.access.remaining })}</p>
        {maximum === 0 ? <Link className={styles.primary} href={href("/pricing")}>{t("Continue with Pro")}</Link> : <button className={styles.primary} disabled={unavailable || !canGenerate} onClick={() => void generate()}>{t("Generate quiz")}<span aria-hidden="true">→</span></button>}
      </div>
    </div>
  </>;
}
