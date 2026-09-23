import { z } from "zod";
import type { GradingMode } from "../../lib/schema";

export const ACTUAL_RESULT_CONSENT_VERSION = "actual-results-v1";
export const ASSIGNMENT_TYPES = ["essay", "report", "research", "problem_set", "presentation", "other", "unspecified"] as const;
export const ASSIGNMENT_TYPE_LABELS: Record<typeof ASSIGNMENT_TYPES[number], string> = {
  essay: "Essay", report: "Report / lab report", research: "Research paper", problem_set: "Problem set",
  presentation: "Presentation", other: "Other", unspecified: "Not specified",
};

export const actualResultInputSchema = z.object({
  score: z.number().finite().nonnegative().nullable(),
  maxScore: z.number().finite().positive().max(1_000_000),
  comment: z.string().trim().max(5000),
  course: z.string().trim().max(80),
  assignmentType: z.enum(ASSIGNMENT_TYPES),
  submissionMatch: z.enum(["same", "revised", "unknown"]),
  consent: z.object({ personalRecord: z.literal(true), qualityValidation: z.boolean(), publicCase: z.boolean() }).strict(),
  expectedRevision: z.string().uuid().nullable(),
}).strict().refine(data => data.score === null || data.score <= data.maxScore, { message: "Actual score must not exceed the maximum.", path: ["score"] })
  .refine(data => data.score !== null || data.comment.length > 0, { message: "Enter a score or a comment.", path: ["comment"] });

export type ActualResultInput = z.infer<typeof actualResultInputSchema>;
export type EvaluationProvenance = {
  model: string | null;
  promptVersion: string;
  inputFingerprint: string;
};
export type ActualResult = Omit<ActualResultInput, "expectedRevision"> & {
  evaluationId: string;
  revision: string;
  createdAt: number;
  updatedAt: number;
  consentVersion: typeof ACTUAL_RESULT_CONSENT_VERSION;
  consentUpdatedAt: number;
  estimate: {
    overallRange: [number, number];
    mode: GradingMode;
    scoringVersion: string | null;
    provenance: EvaluationProvenance | null;
  };
};

// Keep full precision for membership; round only when displaying a value.
export function compareActualResult(record: Pick<ActualResult, "score" | "maxScore" | "estimate">) {
  if (record.score === null) return null;
  const actualPercent = record.score / record.maxScore * 100;
  const [low, high] = record.estimate.overallRange;
  const midpoint = (low + high) / 2;
  const tolerance = Number.EPSILON * 100 * 8;
  const difference = actualPercent - midpoint;
  const distance = Math.max(low - actualPercent, actualPercent - high, 0);
  return { actualPercent, midpoint, difference: Math.abs(difference) <= tolerance ? 0 : difference,
    withinRange: distance <= tolerance,
    distanceOutsideRange: distance <= tolerance ? 0 : distance };
}
