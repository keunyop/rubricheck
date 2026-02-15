import { callStructureModel } from "./openai";
import { RubricSchema, type Rubric } from "./schema";

export async function structureRubric(rubricText: string): Promise<Rubric> {
  const prompt = [
    "Extract a grading rubric from the provided text.",
    "Return strict JSON that matches this schema exactly:",
    '{ "criteria": [{ "name": "string", "max_score": number, "description": "string" }] }',
    "Requirements:",
    "- Include every rubric criterion you can identify.",
    "- For each criterion, provide name, max_score, and description.",
    "- max_score must be numeric.",
    "- description should be concise and faithful to the source.",
    "",
    "Rubric text:",
    rubricText,
  ].join("\n");

  const modelResult = await callStructureModel(prompt);
  const parsed = RubricSchema.safeParse(modelResult);

  if (!parsed.success) {
    throw new Error("RUBRIC_STRUCTURE_FAILED");
  }

  return parsed.data;
}
