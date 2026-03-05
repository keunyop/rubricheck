import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY_MISSING");
}

const client = new OpenAI({ apiKey });

const DEFAULT_OPENAI_TIMEOUT_MS = 180_000;
const MIN_OPENAI_TIMEOUT_MS = 30_000;
const MAX_OPENAI_TIMEOUT_MS = 600_000;
const MIN_OPENAI_MAX_OUTPUT_TOKENS = 256;
const MAX_OPENAI_MAX_OUTPUT_TOKENS = 16_384;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as UnknownRecord;
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof Error) {
    const normalizedName = error.name.toLowerCase();
    const normalizedMessage = error.message.toLowerCase();
    if (
      normalizedName.includes("abort") ||
      normalizedName.includes("timeout") ||
      normalizedMessage.includes("aborted") ||
      normalizedMessage.includes("timeout") ||
      normalizedMessage.includes("timed out") ||
      normalizedMessage.includes("openai_timeout")
    ) {
      return true;
    }
  }

  const record = asRecord(error);
  const errorType = typeof record?.type === "string" ? record.type.toLowerCase() : "";
  return errorType.includes("abort") || errorType.includes("timeout");
}

function resolveStringField(record: UnknownRecord | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
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

export type JsonResponseSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type JsonModelOptions = {
  systemInstruction?: string;
  maxOutputTokens?: number;
  responseSchema?: JsonResponseSchema;
  retryOnMaxOutputTokens?: boolean;
};

const DEFAULT_JSON_SYSTEM_INSTRUCTION =
  "Return a single valid JSON object only. Do not include markdown, code fences, or extra text.";

function resolveOpenAiTimeoutMs(): number {
  const raw = process.env.OPENAI_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  return Math.max(MIN_OPENAI_TIMEOUT_MS, Math.min(MAX_OPENAI_TIMEOUT_MS, parsed));
}

function resolveMaxOutputTokens(raw: number | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  const rounded = Math.round(raw);
  return Math.max(MIN_OPENAI_MAX_OUTPUT_TOKENS, Math.min(MAX_OPENAI_MAX_OUTPUT_TOKENS, rounded));
}

function wasTruncatedByMaxOutputTokens(response: unknown): boolean {
  const record = asRecord(response);
  if (!record) {
    return false;
  }

  const status = resolveStringField(record, "status").toLowerCase();
  if (status !== "incomplete") {
    return false;
  }

  const incompleteDetails = asRecord(record.incomplete_details);
  const reason = resolveStringField(incompleteDetails, "reason").toLowerCase();
  return reason.includes("max_output_tokens") || reason.includes("max_tokens");
}

function growOutputTokenBudget(currentBudget: number): number {
  const grown = Math.round(currentBudget * 1.6) + 128;
  return Math.max(MIN_OPENAI_MAX_OUTPUT_TOKENS, Math.min(MAX_OPENAI_MAX_OUTPUT_TOKENS, grown));
}

async function callJsonModel(
  modelEnvKey: "STRUCTURE_MODEL" | "EVALUATION_MODEL",
  prompt: string,
  options?: JsonModelOptions,
) {
  const model = process.env[modelEnvKey];

  if (!model) {
    throw new Error(`${modelEnvKey}_MISSING`);
  }

  const timeoutMs = resolveOpenAiTimeoutMs();
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort("OPENAI_TIMEOUT");
  }, timeoutMs);

  const retryOnMaxOutputTokens = options?.retryOnMaxOutputTokens ?? true;
  const maxAttempts = retryOnMaxOutputTokens ? 2 : 1;
  let outputTokenBudget = resolveMaxOutputTokens(options?.maxOutputTokens);
  let parseFailure: unknown = null;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: unknown;
      try {
        const requestPayload: Record<string, unknown> = {
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
        };

        if (outputTokenBudget !== null) {
          requestPayload.max_output_tokens = outputTokenBudget;
        }

        if (options?.responseSchema) {
          requestPayload.text = {
            format: {
              type: "json_schema",
              name: options.responseSchema.name,
              schema: options.responseSchema.schema,
              strict: options.responseSchema.strict ?? true,
            },
          };
        }

        response = await client.responses.create(requestPayload as never, {
          signal: abortController.signal,
        });
      } catch (error) {
        if (abortController.signal.aborted || isAbortLikeError(error)) {
          throw new Error("OPENAI_TIMEOUT");
        }

        throw error;
      }

      try {
        return parseModelJsonFromResponse(response);
      } catch (error) {
        parseFailure = error;
      }

      const hitOutputTokenCap = wasTruncatedByMaxOutputTokens(response);
      if (!retryOnMaxOutputTokens || !hitOutputTokenCap || outputTokenBudget === null || attempt >= maxAttempts) {
        break;
      }

      outputTokenBudget = growOutputTokenBudget(outputTokenBudget);
    }

    throw parseFailure ?? new Error("MODEL_JSON_PARSE_FAILED");
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function callStructureModel(prompt: string, options?: JsonModelOptions): Promise<unknown> {
  return callJsonModel("STRUCTURE_MODEL", prompt, options);
}

export async function callEvaluationModel(prompt: string, options?: JsonModelOptions): Promise<unknown> {
  return callJsonModel("EVALUATION_MODEL", prompt, options);
}
