import type { GradingMode, Rubric } from "./schema";

export type EvaluationDetailLevel = "diagnostic" | "detailed";

export const STRICT_JSON_SYSTEM_INSTRUCTION = [
  "Return a single valid JSON object only.",
  "Do not include markdown, code fences, or extra text.",
  "Use a firm, academic, concise tone.",
  "Apply strict and conservative grading with no benefit of doubt.",
].join(" ");

function buildSchemaDescription(mode: GradingMode, detailLevel: EvaluationDetailLevel): string {
  const evidenceShape = mode === "strict" ? '["string", "string"]' : '["string"]';

  if (detailLevel === "detailed") {
    return `{
  "summary": "string",
  "criteria_scores": [
    {
      "name": "string",
      "score": integer,
      "rationale": "string",
      "estimated_range": [integer, integer],
      "feedback": "string",
      "evidence": ${evidenceShape},
      "detailed_breakdown": "string (optional)",
      "example_revisions": ["string", "string"] (optional)
    }
  ],
  "top_improvements": ["string", "string", "string"]
}`;
  }

  return `{
  "summary": "string",
  "criteria_scores": [
    {
      "name": "string",
      "score": integer,
      "rationale": "string",
      "estimated_range": [integer, integer],
      "feedback": "string",
      "evidence": ${evidenceShape}
    }
  ],
  "top_improvements": ["string", "string", "string"]
}`;
}

function buildRules(mode: GradingMode, detailLevel: EvaluationDetailLevel): string[] {
  const sharedRules =
    detailLevel === "detailed"
      ? [
          "- rationale must be one line, <= 220 chars.",
          "- feedback must be one line, <= 1200 chars.",
          "- detailed_breakdown is optional; if included, keep it concise (<= 900 chars).",
          "- example_revisions is optional; if included, provide 1-2 short revision ideas.",
        ]
      : [
          "- rationale must be one line, <= 220 chars.",
          "- feedback must be one line, <= 1200 chars.",
        ];

  if (mode === "strict") {
    return [
      "- Be conservative. Do not give benefit of doubt when evidence is missing or unclear.",
      "- Include one criteria_scores item per rubric criterion.",
      "- Use the rubric criterion names exactly as given and keep the same order.",
      "- Use rubric wording explicitly. Do not invent criteria.",
      "- For each criterion, provide evidence with 1-2 short direct quotes/snippets from the assignment.",
      "- evidence is required and must contain 1-2 items per criterion.",
      "- If evidence is weak/missing, cap score and estimated_range high at <= 60% of criterion max_score.",
      "- Penalize omissions of required content, structure, or format more strongly.",
      "- score and estimated_range must be integers and align with each other.",
      "- estimated_range must be [low, high] with low <= high.",
      ...sharedRules,
      "- summary must be 1-2 sentences, <= 280 chars, concise and academic.",
      "- top_improvements must contain exactly 3 items, each <= 120 chars.",
      "- Do not include numbering prefixes in top_improvements.",
      "- No markdown. No extra keys. No extra text.",
    ];
  }

  return [
    "- Include one criteria_scores item per rubric criterion.",
    "- Use the rubric criterion names exactly as given.",
    "- Keep criteria_scores in the same order as rubric criteria.",
    "- score and estimated_range must be integers and align with each other.",
    "- estimated_range must be [low, high] integers with low <= high.",
    "- Keep each range width modest; target width <= 20% of that criterion max_score.",
    ...sharedRules,
    "- summary must be 1-2 sentences, <= 280 chars, and neutral in tone.",
    "- top_improvements must contain exactly 3 items, each <= 120 chars.",
    "- evidence is optional in standard mode; omit it if not useful.",
    "- Do not include numbering prefixes in top_improvements.",
    "- No markdown. No extra keys. No extra text.",
  ];
}

export function buildEvaluationPrompt(
  rubric: Rubric,
  assignmentText: string,
  mode: GradingMode,
  detailLevel: EvaluationDetailLevel = "diagnostic",
): string {
  const criteriaForScoring = rubric.criteria.map((criterion) => ({
    name: criterion.name,
    max_score: criterion.max_score,
    description: criterion.description,
  }));

  return [
    "Evaluate the assignment using the provided rubric.",
    "Return JSON only, matching this schema exactly:",
    buildSchemaDescription(mode, detailLevel),
    "Rules:",
    ...buildRules(mode, detailLevel),
    "",
    "Rubric criteria (use these names exactly):",
    JSON.stringify(criteriaForScoring),
    "",
    "Assignment text:",
    assignmentText,
  ].join("\n");
}
