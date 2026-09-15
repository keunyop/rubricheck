import { createHash } from "node:crypto";
import { callSupabaseRpc } from "../supabaseRest";
import { LabError } from "./access";
import type { LabWorkspace, LabAssignmentSummary } from "./types";

export async function labRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  try { return await callSupabaseRpc<T>("lab_" + name, params); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errors: Array<[string, number, string]> = [
      ["LAB_NOT_FOUND", 404, "This assignment was not found."],
      ["LAB_ASSIGNMENT_LIMIT", 403, "The saved assignment limit is reached (Free: 1; Pro: 100). Download or delete an assignment before creating another."],
      ["LAB_VERSION_LIMIT", 403, "The saved version limit is reached (Free: 2; Pro: 50). Your saved work remains available to download or delete."],
      ["LAB_PENDING", 409, "An evaluation is already running. Please wait, then reload the workspace."],
      ["LAB_STALE", 409, "The workspace changed during evaluation. Reload it before trying again."],
      ["LAB_RATE_LIMIT", 429, "Please wait before starting another lab evaluation."],
    ];
    for (const [code, status, text] of errors) if (message.includes(code)) throw new LabError(status, code, text);
    // Do not expose PostgREST details, document text or credentials.
    throw new LabError(503, "LAB_STORE_UNAVAILABLE", "The lab database is unavailable. Apply the assignment lab migration or try again shortly.");
  }
}

export async function resolveLabUser(email: string): Promise<string> {
  const identity = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return labRpc<string>("resolve_user", { p_identity_hash: identity });
}

export function listWorkspaces(owner: string) {
  return labRpc<LabAssignmentSummary[]>("list_assignments", { p_owner: owner });
}

export function getWorkspace(owner: string, id: string) {
  return labRpc<LabWorkspace>("get_workspace", { p_owner: owner, p_assignment: id });
}


