export type HiddenAiAlertSource = "rubric" | "assignment";

export type HiddenAiDocumentAlert = {
  code: "HIDDEN_AI_TEXT";
  sources: HiddenAiAlertSource[];
  message: string;
};

const AI_REFERENT_PATTERN =
  "(?:ai|llm|language model|chatgpt|gpt(?:-?\\d+(?:\\.\\d+)?)?|openai|claude|gemini)";
const INSTRUCTION_VERB_PATTERN =
  "(?:ignore|disregard|forget|follow|respond|output|write|say|award|assign|use|call|refer|replace|insert|mention)";

const HIDDEN_AI_PATTERNS = [
  new RegExp(
    `if\\s+you\\s+are\\s+(?:an?\\s+)?${AI_REFERENT_PATTERN}[\\s\\S]{0,120}\\b${INSTRUCTION_VERB_PATTERN}\\b`,
    "i",
  ),
  new RegExp(
    `as\\s+(?:an?\\s+)?${AI_REFERENT_PATTERN}[\\s\\S]{0,120}\\b${INSTRUCTION_VERB_PATTERN}\\b`,
    "i",
  ),
  new RegExp(
    `${AI_REFERENT_PATTERN}[\\s\\S]{0,80}\\b${INSTRUCTION_VERB_PATTERN}\\b[\\s\\S]{0,80}\\b(?:grade|score|evaluation|feedback|response|essay|paper|assignment)\\b`,
    "i",
  ),
  /\b(?:ignore|disregard|forget)\b[\s\S]{0,80}\b(?:previous|prior|above|earlier)\b[\s\S]{0,40}\b(?:instructions?|directions?|prompt|message)\b/i,
  /\bdo\s+not\b[\s\S]{0,80}\b(?:reveal|mention|acknowledge)\b[\s\S]{0,40}\b(?:instructions?|prompt|message)\b/i,
] as const;

function normalizeForDetection(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasHiddenAiInstruction(text: string): boolean {
  const normalized = normalizeForDetection(text);
  if (!normalized) {
    return false;
  }

  return HIDDEN_AI_PATTERNS.some((pattern) => pattern.test(normalized));
}

function formatAlertTarget(sources: HiddenAiAlertSource[]): string {
  if (sources.length === 2) {
    return "uploaded rubric and assignment";
  }

  return sources[0] === "rubric" ? "uploaded rubric" : "uploaded assignment";
}

export function detectHiddenAiAlert(input: {
  rubricText: string;
  assignmentText: string;
}): HiddenAiDocumentAlert | null {
  const sources: HiddenAiAlertSource[] = [];

  if (hasHiddenAiInstruction(input.rubricText)) {
    sources.push("rubric");
  }

  if (hasHiddenAiInstruction(input.assignmentText)) {
    sources.push("assignment");
  }

  if (sources.length === 0) {
    return null;
  }

  return {
    code: "HIDDEN_AI_TEXT",
    sources,
    message: `Hidden AI-directed instructions were detected in the ${formatAlertTarget(sources)}. This content may try to manipulate automated grading.`,
  };
}
