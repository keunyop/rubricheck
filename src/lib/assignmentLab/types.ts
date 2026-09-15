import type { Rubric, GradingMode } from "../../../lib/schema";
import type { FinalEvaluation } from "../../../lib/gradeFinalization";

export type LabConditions = {
  rubricVersionId: string;
  mode: GradingMode;
  model: string;
  evaluationPromptVersion: string;
  coachingPromptVersion: string;
  structureModel: string;
  structurePromptVersion: string;
  scoringVersion: string;
};
export type LabTask = {
  task_key: string;
  criterion_index: number;
  title: string;
  reason: string;
  required_evidence: string;
  question: string;
  status: "new" | "remaining" | "resolved" | "uncertain";
  review_reason: string;
  evidence: string[];
  user_done: boolean;
};
export type LabRun = {
  id: string;
  version: number;
  draft_text: string;
  input_hash: string;
  conditions: LabConditions;
  result: FinalEvaluation;
  tasks: LabTask[];
  created_at: string;
};
export type LabAssignmentSummary = { id: string; title: string; created_at: string; run_count: number };
export type LabWorkspace = {
  assignment: LabAssignmentSummary & { initial_draft: string; mode: GradingMode };
  rubric: { id: string; raw_text: string; structured: Rubric | null; structure_model: string | null };
  runs: LabRun[];
};

export function compareConditions(before: LabConditions, after: LabConditions): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key as keyof LabConditions] !== after[key as keyof LabConditions]);
}

export function compareCriteria(before: LabRun, after: LabRun) {
  const changedConditions = compareConditions(before.conditions, after.conditions);
  return after.result.criteria.map((criterion, index) => {
    const previous = before.result.criteria[index];
    const comparable = changedConditions.length === 0 && previous?.name === criterion.name && previous.max_score === criterion.max_score;
    return { criterion, previous, comparable, delta: comparable ? criterion.score - previous.score : null };
  });
}

