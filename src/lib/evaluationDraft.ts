export const DRAFT_KEY = "rubricheck_evaluation_draft_v1";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export type EvaluationDraft = {
  ownerEmail?: string;
  projectId?: string | null;
  rubricMode: "file" | "text";
  assignmentMode: "file" | "text";
  rubricText: string;
  assignmentText: string;
  gradingMode: "standard" | "strict";
  hadRubricFile: boolean;
  hadAssignmentFile: boolean;
  savedAt: number;
};

export function parseDraft(raw: string | null, now = Date.now()): EvaluationDraft | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt > DRAFT_TTL_MS ||
      typeof value.rubricText !== "string" || typeof value.assignmentText !== "string") return null;
    return {
      ...value,
      rubricMode: value.rubricMode === "text" ? "text" : "file",
      assignmentMode: value.assignmentMode === "text" ? "text" : "file",
      gradingMode: value.gradingMode === "strict" ? "strict" : "standard",
    };
  } catch { return null; }
}

function openFilesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rubricheck_drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Browser-only file storage, isolated by tab. Expired entries are removed on access.
export async function saveDraftFiles(key: string, rubric: File[], assignment: File[]): Promise<void> {
  const db = await openFilesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      const store = tx.objectStore("files");
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (Date.now() - row.value.savedAt > DRAFT_TTL_MS) row.delete();
        row.continue();
      };
      store.put({ rubric, assignment, savedAt: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function loadDraftFiles(key: string): Promise<{ rubric: File[]; assignment: File[] } | null> {
  const db = await openFilesDb();
  try {
    return await new Promise((resolve, reject) => {
      const store = db.transaction("files", "readwrite").objectStore("files");
      const request = store.get(key);
      request.onsuccess = () => {
        const row = request.result;
        if (!row || Date.now() - row.savedAt > DRAFT_TTL_MS) {
          store.delete(key);
          resolve(null);
        } else resolve(row);
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
