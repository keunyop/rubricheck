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
const OUTPUT_TARGET_PATTERN =
  "(?:grade|score|evaluation|feedback|response|essay|paper|assignment|submission|rubric|criterion|criteria|student|author|name)";

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
const AI_REFERENT_REGEX = new RegExp(`\\b${AI_REFERENT_PATTERN}\\b`, "i");
const INSTRUCTION_VERB_REGEX = new RegExp(`\\b${INSTRUCTION_VERB_PATTERN}\\b`, "i");
const OUTPUT_TARGET_REGEX = new RegExp(`\\b${OUTPUT_TARGET_PATTERN}\\b`, "i");
const PREVIOUS_INSTRUCTION_REGEX =
  /\b(?:ignore|disregard|forget)\b[\s\S]{0,80}\b(?:previous|prior|above|earlier)\b[\s\S]{0,40}\b(?:instructions?|directions?|prompt|message)\b/i;
const CONCEALMENT_REGEX =
  /\b(?:do\s+not|don't|never)\b[\s\S]{0,80}\b(?:reveal|mention|acknowledge|disclose|tell)\b[\s\S]{0,40}\b(?:instructions?|prompt|message|rule|trap)\b/i;
const IDENTITY_MANIPULATION_REGEX =
  /\b(?:student|author)(?:'s)?\s+name\b|\b(?:call|refer to|replace|use)\b[\s\S]{0,30}\b(?:student|author|name)\b/i;

function normalizeForDetection(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildDetectionWindows(text: string): string[] {
  const segments = text
    .split(/(?:[.!?]+\s+)|\n+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const windows: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    windows.push(current);

    const next = segments[index + 1];
    if (next) {
      windows.push(`${current} ${next}`);
    }
  }

  return windows.length > 0 ? windows : [text];
}

function hasContextualHiddenAiInstruction(text: string): boolean {
  return buildDetectionWindows(text).some((windowText) => {
    const hasAiReferent = AI_REFERENT_REGEX.test(windowText);
    const hasInstructionVerb = INSTRUCTION_VERB_REGEX.test(windowText);
    const hasOutputTarget = OUTPUT_TARGET_REGEX.test(windowText);
    const hasPreviousInstructionOverride = PREVIOUS_INSTRUCTION_REGEX.test(windowText);
    const hasConcealment = CONCEALMENT_REGEX.test(windowText);
    const hasIdentityManipulation = IDENTITY_MANIPULATION_REGEX.test(windowText);

    if (hasAiReferent && (hasPreviousInstructionOverride || hasConcealment)) {
      return true;
    }

    if (hasAiReferent && hasInstructionVerb && (hasOutputTarget || hasIdentityManipulation)) {
      return true;
    }

    if (hasPreviousInstructionOverride && (hasOutputTarget || hasAiReferent)) {
      return true;
    }

    if (hasConcealment && (hasAiReferent || hasInstructionVerb)) {
      return true;
    }

    const suspicionScore =
      (hasAiReferent ? 2 : 0) +
      (hasInstructionVerb ? 1 : 0) +
      (hasOutputTarget ? 1 : 0) +
      (hasIdentityManipulation ? 2 : 0) +
      (hasPreviousInstructionOverride ? 3 : 0) +
      (hasConcealment ? 3 : 0);

    return suspicionScore >= 5;
  });
}

function hasHiddenAiInstruction(text: string): boolean {
  const normalized = normalizeForDetection(text);
  if (!normalized) {
    return false;
  }

  return HIDDEN_AI_PATTERNS.some((pattern) => pattern.test(normalized)) || hasContextualHiddenAiInstruction(normalized);
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
