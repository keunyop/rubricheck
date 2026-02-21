import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY_MISSING");
}

const client = new OpenAI({ apiKey });

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as UnknownRecord;
}

function collectResponseTextCandidates(response: unknown): string[] {
  const candidates: string[] = [];
  const responseRecord = asRecord(response);
  if (!responseRecord) {
    return candidates;
  }

  const outputText = responseRecord.output_text;
  if (typeof outputText === "string" && outputText.length > 0) {
    candidates.push(outputText);
  }

  const outputs = Array.isArray(responseRecord.output) ? responseRecord.output : [];

  for (const output of outputs) {
    const outputRecord = asRecord(output);
    if (!outputRecord) {
      continue;
    }

    const contentItems = Array.isArray(outputRecord.content) ? outputRecord.content : [];

    for (const content of contentItems) {
      const contentRecord = asRecord(content);
      if (!contentRecord) {
        continue;
      }

      if (typeof contentRecord.text === "string" && contentRecord.text.length > 0) {
        candidates.push(contentRecord.text);
      }

      const textRecord = asRecord(contentRecord.text);
      const textValue = textRecord?.value;
      if (typeof textValue === "string" && textValue.length > 0) {
        candidates.push(textValue);
      }
    }
  }

  return candidates;
}

function buildJsonParseAttempts(text: string): string[] {
  const attempts: string[] = [];
  const trimmed = text.trim();

  if (!trimmed) {
    return attempts;
  }

  attempts.push(trimmed);

  const fencedMatches = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/gi) ?? [];
  for (const block of fencedMatches) {
    const unwrapped = block.replace(/```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    if (unwrapped) {
      attempts.push(unwrapped);
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    attempts.push(trimmed.slice(objectStart, objectEnd + 1).trim());
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    attempts.push(trimmed.slice(arrayStart, arrayEnd + 1).trim());
  }

  return [...new Set(attempts)];
}

function parseModelJsonFromResponse(response: unknown): unknown {
  const candidates = collectResponseTextCandidates(response);

  for (const text of candidates) {
    const attempts = buildJsonParseAttempts(text);

    for (const attempt of attempts) {
      try {
        return JSON.parse(attempt);
      } catch {
        // Try next parse attempt.
      }
    }
  }

  throw new Error("MODEL_JSON_PARSE_FAILED");
}

type JsonModelOptions = {
  systemInstruction?: string;
};

const DEFAULT_JSON_SYSTEM_INSTRUCTION =
  "Return a single valid JSON object only. Do not include markdown, code fences, or extra text.";

async function callJsonModel(
  modelEnvKey: "STRUCTURE_MODEL" | "EVALUATION_MODEL",
  prompt: string,
  options?: JsonModelOptions,
) {
  const model = process.env[modelEnvKey];

  if (!model) {
    throw new Error(`${modelEnvKey}_MISSING`);
  }

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: options?.systemInstruction ?? DEFAULT_JSON_SYSTEM_INSTRUCTION,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return parseModelJsonFromResponse(response);
}

export async function callStructureModel(prompt: string, options?: JsonModelOptions): Promise<unknown> {
  return callJsonModel("STRUCTURE_MODEL", prompt, options);
}

export async function callEvaluationModel(prompt: string, options?: JsonModelOptions): Promise<unknown> {
  return callJsonModel("EVALUATION_MODEL", prompt, options);
}
