import { createHash } from "node:crypto";
import { buildEvaluationPrompt, STRICT_JSON_SYSTEM_INSTRUCTION } from "../../lib/evaluationPrompt";
import type { GradingMode, Rubric } from "../../lib/schema";
import type { EvaluationProvenance } from "./actualResultTypes";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

// Hash the template with fixed inputs so prompt edits create a new version automatically.
// No documents or model calls are added to permanent storage.
export function evaluationProvenance(rubric: Rubric, assignmentText: string, mode: GradingMode, fullDetail: boolean): EvaluationProvenance {
  const template = buildEvaluationPrompt(
    { criteria: [{ name: "Provenance criterion", max_score: 100, description: "Provenance descriptor" }] },
    "Provenance assignment", mode, fullDetail ? "detailed" : "diagnostic",
  );
  return {
    model: process.env.EVALUATION_MODEL?.trim() || null,
    promptVersion: hash(template + (mode === "strict" ? STRICT_JSON_SYSTEM_INSTRUCTION : "")),
    inputFingerprint: hash(JSON.stringify({ rubric, assignmentText })),
  };
}
