import { createHash, randomUUID } from "node:crypto";
import { structureRubric } from "../../../lib/rubricStructuring";
import { evaluateAssignment } from "../../../lib/evaluation";
import { buildEvaluationPrompt, STRICT_JSON_SYSTEM_INSTRUCTION } from "../../../lib/evaluationPrompt";
import { buildFinalEvaluation } from "../../../lib/gradeFinalization";
import { callEvaluationModel } from "../../../lib/openai";
import { LabError } from "./access";
import { getWorkspace, labRpc } from "./store";
import { COACHING_INSTRUCTION, buildRevisionTasks } from "./coaching";
import type { LabConditions, LabWorkspace } from "./types";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizeLabDraft = (value: string) => value.replace(/\r\n?/g, "\n").trim();

export function conditionsFor(workspace: LabWorkspace): LabConditions {
  const model = process.env.EVALUATION_MODEL?.trim();
  const structureModel = workspace.rubric.structure_model ?? process.env.STRUCTURE_MODEL?.trim();
  if (!model || !structureModel) throw new LabError(503, "LAB_MODEL_UNAVAILABLE", "The lab evaluation model is not configured.");
  return {
    rubricVersionId: workspace.rubric.id,
    mode: workspace.assignment.mode,
    model,
    evaluationPromptVersion: hash(buildEvaluationPrompt({ criteria: [] }, "", workspace.assignment.mode, "diagnostic") + STRICT_JSON_SYSTEM_INSTRUCTION),
    coachingPromptVersion: hash(COACHING_INSTRUCTION + "constraints-v2-repair-v1"),
    structureModel,
    structurePromptVersion: "rubric-structure-v1",
    scoringVersion: "rubric-sum-v2",
  };
}

export function labInputHash(draft: string, conditions: LabConditions): string {
  return hash(JSON.stringify({ draft: normalizeLabDraft(draft), conditions }));
}

async function generate(workspace: LabWorkspace, draft: string, signal: AbortSignal) {
  const rubric = workspace.rubric.structured ?? await structureRubric(workspace.rubric.raw_text, { cacheRedisOverride: null });
  signal.throwIfAborted();
  if (rubric.criteria.length > 30 || new Set(rubric.criteria.map(c => c.name.trim().toLowerCase())).size !== rubric.criteria.length) {
    throw new LabError(400, "LAB_RUBRIC_INVALID", "Use a rubric with 2–30 distinctly named criteria.");
  }
  // No previous scores or checklist are supplied to the grading step.
  const evaluation = await evaluateAssignment(rubric, draft, workspace.assignment.mode, { detailLevel: "diagnostic" });
  signal.throwIfAborted();
  const result = buildFinalEvaluation(rubric, evaluation, workspace.assignment.mode, "topup");
  const previousTasks = workspace.runs.at(-1)?.tasks ?? [];
  const prompt = COACHING_INSTRUCTION + "\nCONSTRAINTS:\n" +
    (previousTasks.length
      ? "Only review these exact task_id values: " + previousTasks.map(task => task.task_key).join(", ")
      : "This is the FIRST review. There are NO prior tasks. The reviews array MUST be empty: []. Put every current omission in issues.") +
    "\nDOCUMENT DATA:\n" + JSON.stringify({
      rubric, draft, evaluation: result,
      previous_tasks: previousTasks.map(task => ({
        task_id: task.task_key, criterion_index: task.criterion_index, title: task.title,
        reason: task.reason, required_evidence: task.required_evidence, question: task.question, status: task.status,
      })),
    });
  let coaching = await callEvaluationModel(prompt);
  signal.throwIfAborted();
  try {
    return { rubric, result, tasks: buildRevisionTasks(coaching, previousTasks, rubric.criteria.length, draft) };
  } catch {
    // One bounded repair; malformed or unverified reviews are never saved.
    coaching = await callEvaluationModel(prompt +
      "\nYour last response failed validation. Return corrected JSON with every prior task reviewed exactly once, no invented task IDs, zero-based valid criterion indexes, and the specified string limits. If no prior tasks exist, reviews MUST be [].\nINVALID RESPONSE DATA:\n" +
      JSON.stringify(coaching).slice(0, 16000));
    signal.throwIfAborted();
    return { rubric, result, tasks: buildRevisionTasks(coaching, previousTasks, rubric.criteria.length, draft) };
  }
}

export async function evaluateLabAssignment(owner: string, id: string, rawDraft: string, pro: boolean) {
  const draft = normalizeLabDraft(rawDraft);
  const workspace = await getWorkspace(owner, id);
  const conditions = conditionsFor(workspace);
  const inputHash = labInputHash(draft, conditions);
  const token = randomUUID();
  let reservation: { reused: boolean; run_id?: string };
  try {
    reservation = await labRpc("begin_run", {
      p_owner: owner, p_assignment: id, p_hash: inputHash, p_token: token, p_pro: pro,
    });
  } catch (error) {
    // The database may have reserved successfully before the response was lost.
    try { await labRpc("release_run", { p_owner: owner, p_assignment: id, p_token: token }); } catch {}
    throw error;
  }
  if (reservation.reused) return { workspace: await getWorkspace(owner, id), reused: true, runId: reservation.run_id };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    // Re-read after acquiring the lease so a just-finished version becomes the comparison baseline.
    const lockedWorkspace = await getWorkspace(owner, id);
    if (JSON.stringify(conditionsFor(lockedWorkspace)) !== JSON.stringify(conditions)) {
      throw new LabError(409, "LAB_CONDITIONS_CHANGED", "Evaluation settings changed. Please retry.");
    }
    const generated = await Promise.race([
      generate(lockedWorkspace, draft, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new LabError(504, "LAB_TIMEOUT", "Evaluation timed out. Your saved versions are safe; retry the same draft."));
        }, 260000);
      }),
    ]);
    if (JSON.stringify(conditionsFor(lockedWorkspace)) !== JSON.stringify(conditions)) {
      throw new LabError(409, "LAB_CONDITIONS_CHANGED", "Evaluation settings changed. Please retry.");
    }
    const params = {
      p_owner: owner, p_assignment: id, p_token: token, p_hash: inputHash, p_draft: draft,
      p_conditions: conditions, p_rubric: generated.rubric, p_result: generated.result, p_tasks: generated.tasks,
    };
    let runId: string;
    try { runId = await labRpc<string>("finish_run", params); }
    catch (error) {
      if (!(error instanceof LabError) || error.status !== 503) throw error;
      runId = await labRpc<string>("finish_run", params);
    }
    return { workspace: await getWorkspace(owner, id), reused: false, runId };
  } finally {
    controller.abort();
    if (timer) clearTimeout(timer);
    try { await labRpc("release_run", { p_owner: owner, p_assignment: id, p_token: token }); }
    catch { console.warn("ASSIGNMENT_LAB_LEASE_RELEASE_FAILED"); }
  }
}

