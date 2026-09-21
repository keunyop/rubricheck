import type { FinalEvaluation } from "../../lib/gradeFinalization";

export type TrialPreview = Pick<FinalEvaluation, "title" | "overall_range" | "summary" | "grading_basis"> & { guest_preview: true };

export function isTrialPreview(value: unknown): value is TrialPreview {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TrialPreview>;
  return item.guest_preview === true && typeof item.title === "string" && typeof item.summary === "string"
    && Array.isArray(item.overall_range) && item.overall_range.length === 2
    && item.overall_range.every(score => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100)
    && item.overall_range[0] <= item.overall_range[1];
}

