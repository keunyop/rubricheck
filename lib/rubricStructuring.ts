import { callStructureModel } from "./openai";
import { RubricSchema, type Rubric } from "./schema";

export async function structureRubric(rubricText: string): Promise<Rubric> {
  const prompt = [
    "Extract rubric criteria from the text.",
    "Return JSON only, matching this schema exactly:",
    '{ "criteria": [{ "name": "string", "max_score": number, "description": "string" }] }',
    "Rules:",
    "- Include all identifiable criteria.",
    "- Each criterion must include name, max_score, description.",
    "- max_score must be numeric. If missing, infer from rubric scale; if unclear, use 1.",
    "- description must be short and faithful.",
    "- No markdown. No extra keys. No extra text.",
    "",
    "Rubric text:",
    rubricText,
  ].join("\n");

  try {
    const modelResult = await callStructureModel(prompt);
    const parsed = RubricSchema.safeParse(modelResult);

    if (!parsed.success) {
      throw new Error("RUBRIC_STRUCTURE_FAILED");
    }

    return parsed.data;
  } catch {
    throw new Error("RUBRIC_STRUCTURE_FAILED");
  }
}
