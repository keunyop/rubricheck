import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY_MISSING");
}

const client = new OpenAI({ apiKey });

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

function parseModelJson(text: string): any {
  const candidate = extractJsonCandidate(text);

  if (!candidate) {
    throw new Error("MODEL_JSON_PARSE_FAILED");
  }

  try {
    const parsed = JSON.parse(candidate);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("MODEL_JSON_PARSE_FAILED");
    }

    return parsed;
  } catch {
    throw new Error("MODEL_JSON_PARSE_FAILED");
  }
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

  const outputText = response.output_text ?? "";
  return parseModelJson(outputText);
}

export async function callStructureModel(prompt: string): Promise<any> {
  return callJsonModel("STRUCTURE_MODEL", prompt);
}

export async function callEvaluationModel(prompt: string): Promise<any> {
  return callJsonModel("EVALUATION_MODEL", prompt);
}
