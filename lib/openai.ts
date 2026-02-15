import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY_MISSING");
}

const client = new OpenAI({ apiKey });

function collectResponseTextCandidates(response: any): string[] {
  const candidates: string[] = [];

  if (typeof response?.output_text === "string" && response.output_text.length > 0) {
    candidates.push(response.output_text);
  }

  const outputs = Array.isArray(response?.output) ? response.output : [];

  for (const output of outputs) {
    const contentItems = Array.isArray(output?.content) ? output.content : [];

    for (const content of contentItems) {
      if (typeof content?.text === "string" && content.text.length > 0) {
        candidates.push(content.text);
      }
      if (typeof content?.text?.value === "string" && content.text.value.length > 0) {
        candidates.push(content.text.value);
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

function parseModelJsonFromResponse(response: any): any {
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

async function callJsonModel(modelEnvKey: "STRUCTURE_MODEL" | "EVALUATION_MODEL", prompt: string) {
  const model = process.env[modelEnvKey];

  if (!model) {
    throw new Error(`${modelEnvKey}_MISSING`);
  }

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "Return a single valid JSON object only. Do not include markdown, code fences, or extra text.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return parseModelJsonFromResponse(response);
}

export async function callStructureModel(prompt: string): Promise<any> {
  return callJsonModel("STRUCTURE_MODEL", prompt);
}

export async function callEvaluationModel(prompt: string): Promise<any> {
  return callJsonModel("EVALUATION_MODEL", prompt);
}
