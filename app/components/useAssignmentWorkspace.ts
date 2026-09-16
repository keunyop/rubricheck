"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssignmentProject, AssignmentWorkspace } from "../../src/lib/assignmentWorkspaceTypes";

const EMPTY: AssignmentWorkspace = { projects: [], assignments: [] };
export function useAssignmentWorkspace(email: string, evaluationId?: string) {
  const [state, setState] = useState<{ owner: string; data: AssignmentWorkspace; error: string; loading: boolean }>({ owner: "", data: EMPTY, error: "", loading: false });
  const owner = useRef(email);
  owner.current = email;
  const generation = useRef(0);
  const imported = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!email) { setState({ owner: "", data: EMPTY, error: "", loading: false }); return; }
    setState(previous => ({ owner: email, data: previous.owner === email ? previous.data : EMPTY, error: "", loading: true }));
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load your assignments.");
      if (!Array.isArray(data.projects) || !Array.isArray(data.assignments)) throw new Error("Could not load your assignments.");
      if (owner.current !== email || request !== generation.current) return;
      setState({ owner: email, data, error: "", loading: false });
      // Preserve a pre-sidebar result while its server recovery copy still exists.
      const importKey = email + ":" + evaluationId;
      if (evaluationId && !data.assignments.some((item: { id: string }) => item.id === evaluationId) && !imported.current.has(importKey)) {
        imported.current.add(importKey);
        const importedResult = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "importEvaluation", id: evaluationId }) });
        if (importedResult.ok && owner.current === email && request === generation.current) {
          const next = await fetch("/api/workspace", { cache: "no-store" });
          const updated = await next.json();
          if (next.ok && owner.current === email && request === generation.current) setState({ owner: email, data: updated, error: "", loading: false });
        }
      }
    } catch (error) {
      if (owner.current === email && request === generation.current) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : "Could not load your assignments.", loading: false }));
    }
  }, [email, evaluationId]);

  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void refresh(); return invalidate; }, [refresh, invalidate]);

  const mutate = useCallback(async (payload: Record<string, unknown>): Promise<AssignmentProject | undefined> => {
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not save your changes.");
    if (owner.current !== email) throw new Error("Your account changed. Please try again.");
    await refresh();
    return data.project;
  }, [email, refresh]);

  return { ...(state.owner === email ? state : { data: EMPTY, error: "", loading: Boolean(email) }), refresh, mutate };
}
