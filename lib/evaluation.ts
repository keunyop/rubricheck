import { callEvaluationModel } from "./openai";
import { EvaluationSchema, type Evaluation } from "./schema";

export async function evaluateAssignment(
  structuredRubric: any,
  assignmentText: string,
): Promise<Evaluation> {
  const prompt = [
    "Evaluate the assignment against the structured rubric.",
    "Return strict JSON that matches this schema exactly:",
    `{
  "overall_range": [number, number],
  "summary": "string",
  "criteria_scores": [
    {
      "name": "string",
      "estimated_range": [number, number],
      "feedback": "string"
    }
  ],
  "top_improvements": ["string", "string", "string"]
}`,
    "Requirements:",
    "- overall_range must be [low, high].",
    "- criteria_scores must include estimated_range and feedback for each criterion.",
    "- summary must briefly describe overall performance.",
    "- top_improvements must include 3 to 5 specific, actionable items.",
    "- Keep criterion names aligned to the provided rubric criteria.",
    "",
    "Structured rubric JSON:",
    JSON.stringify(structuredRubric),
    "",
    "Assignment text:",
    assignmentText,
  ].join("\n");

  const modelResult = await callEvaluationModel(prompt);
  const parsed = EvaluationSchema.safeParse(modelResult);

  if (!parsed.success) {
    throw new Error("EVALUATION_FAILED");
  }

  return parsed.data;
}
