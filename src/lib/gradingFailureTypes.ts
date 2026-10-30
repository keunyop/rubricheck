export const GRADING_FAILURE_RETENTION_DAYS = 7;
export type GradingFailureStage = "file_parsing" | "rubric_structuring" | "ai_evaluation" | "finalization" | "trial_result_storage";
export type GradingFailureSummary = {
  id: string;
  requestId: string;
  createdAt: number;
  expiresAt: number;
  stage: GradingFailureStage;
  code: string;
  accountEmail: string | null;
  mode: "standard" | "strict";
  language: string;
  captureStatus: "complete" | "metadata_only";
};
export type FailureFile = { field: "rubric" | "assignment"; name: string; type: string; size: number };
export type GradingFailureDetail = GradingFailureSummary & {
  inputs: {
    rubricSource: "provided" | "general" | "saved";
    rubricId: string | null;
    rubricText: string | null;
    assignmentText: string | null;
    assignmentInstructions: string;
    extractedRubricText: string | null;
    extractedAssignmentText: string | null;
  };
  files: FailureFile[];
  structureModel: string | null;
  evaluationModel: string | null;
  deployment: string | null;
  captureNote: string | null;
};
export type GradingFailurePage = { items: GradingFailureSummary[]; nextOffset: number | null };
