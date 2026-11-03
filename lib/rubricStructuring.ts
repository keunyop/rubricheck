import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

import { callStructureModel } from "./openai";
import { RubricSchema, type Rubric } from "./schema";
import { RUBRIC_CACHE_VERSION } from "./rubricVersion";

export { RUBRIC_CACHE_VERSION } from "./rubricVersion";
export const RUBRIC_CACHE_TTL_SECONDS = 604800;
let cacheRedisClient: RubricCacheRedisClient | null | undefined;

type RubricCacheIdentity =
  | {
      userIdType: "customer";
      userIdValue: string;
    }
  | {
      userIdType: "emailhash";
      userIdValue: string;
    };

type RubricCacheRedisClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string, options: { ex: number }) => Promise<unknown>;
  incr: (key: string) => Promise<unknown>;
};

type StructureRubricOptions = {
  cacheIdentity?: RubricCacheIdentity | null;
  requestId?: string;
  cacheRedisOverride?: RubricCacheRedisClient | null;
  modelCaller?: typeof callStructureModel;
};

function getOptionalCacheRedisClient(): RubricCacheRedisClient | null {
  if (cacheRedisClient !== undefined) {
    return cacheRedisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    cacheRedisClient = null;
    return cacheRedisClient;
  }

  cacheRedisClient = new Redis({ url, token }) as unknown as RubricCacheRedisClient;
  return cacheRedisClient;
}

function normalizeRubricText(rubricText: string): string {
  return rubricText.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

function buildRubricCacheKey(rubricText: string, identity: RubricCacheIdentity): string {
  const normalizedText = normalizeRubricText(rubricText);
  const fingerprint = [RUBRIC_CACHE_VERSION, identity.userIdType, identity.userIdValue, normalizedText].join("|");
  const hash = createHash("sha256").update(fingerprint).digest("hex");
  return `rubric_struct_cache:${RUBRIC_CACHE_VERSION}:${identity.userIdType}:${identity.userIdValue}:${hash}`;
}

function incrementCounter(cacheRedis: Pick<RubricCacheRedisClient, "incr"> | null, counterName: string): void {
  if (!cacheRedis) {
    return;
  }

  void cacheRedis.incr(counterName).catch(() => {
    // Ignore counter errors.
  });
}

function classifyCacheSetFailure(error: unknown): "value_too_large" | "redis_error" {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("too large") || message.includes("max") || message.includes("payload")) {
    return "value_too_large";
  }

  return "redis_error";
}

export function hashNormalizedEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

export async function structureRubric(rubricText: string, options: StructureRubricOptions = {}): Promise<Rubric> {
  const cacheRedis = options.cacheRedisOverride === undefined ? getOptionalCacheRedisClient() : options.cacheRedisOverride;
  const { cacheIdentity = null, requestId } = options;

  if (!cacheIdentity) {
    incrementCounter(cacheRedis, "rubric_cache_skipped_no_user");
  }

  const cacheKey = cacheIdentity ? buildRubricCacheKey(rubricText, cacheIdentity) : null;

  if (cacheRedis && cacheKey) {
    try {
      const cached = await cacheRedis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        // Upstash deserializes JSON by default; older clients may return a string.
        const parsedCached = RubricSchema.safeParse(typeof cached === "string" ? JSON.parse(cached) : cached);
        if (parsedCached.success) {
          incrementCounter(cacheRedis, "rubric_cache_hit");
          console.info("RUBRIC_STRUCT_CACHE", {
            requestId,
            cacheHit: true,
            keyPrefix: cacheKey.slice(0, 32),
          });
          return parsedCached.data;
        }
      }

      incrementCounter(cacheRedis, "rubric_cache_miss");
      console.info("RUBRIC_STRUCT_CACHE", {
        requestId,
        cacheHit: false,
        keyPrefix: cacheKey.slice(0, 32),
      });
    } catch (cacheGetError) {
      console.warn("RUBRIC_STRUCT_CACHE_GET_FAILED", {
        requestId,
        reason: cacheGetError instanceof SyntaxError ? "invalid_json" : "redis_error",
        keyPrefix: cacheKey.slice(0, 32),
      });
      incrementCounter(cacheRedis, "rubric_cache_miss");
      // Ignore cache read errors and continue with model call.
    }
  }

  const prompt = [
    "Extract rubric criteria from the text.",
    "Return JSON only, matching this schema exactly:",
    '{ "total_score": number, "criteria": [{ "name": "string", "max_score": number, "description": "string" }], "adjustments": [{ "name": "string", "kind": "deduction" | "bonus", "max_points": number, "description": "string" }] }',
    "Rules:",
    "- Include all identifiable criteria.",
    "- A document may contain several independent scoring tables (for example Report, Presentation, and Q&A). Include their criteria once each, qualifying names by section when needed to keep names unique. A section subtotal or a course contribution percentage is not an overall raw-points total.",
    "- If explicit points tables are present, criteria must contain only their base scoring categories with their exact point weights. Their sum must equal the applicable overall raw-points total, if one is stated. Incorporate supporting assignment requirements into those descriptions, not extra point-bearing categories.",
    "- Total and subtotal rows summarize existing categories; never count them again as criteria. Performance-level columns describe alternative scores for the same criterion, not additional criteria or point weights.",
    "- Preserve explicit point weights and any stated overall raw-points total. Never rescale weights or change that overall total to hide a mismatch. Re-read the source to distinguish base categories, subtotals, performance levels, and adjustments before returning.",
    "- total_score is the stated overall raw-points base total for ALL extracted criteria (for example 100), excluding bonus and penalty points. If no overall raw-points total is stated, use the sum of the extracted base criterion weights. Do not add section-header denominators or mix course percentages with raw marks to invent an overall total. Preserve each row's explicit maximum even when a section heading has an inconsistent subtotal. Check the sum before returning.",
    "- Automatic deductions and optional bonus points are NOT base criteria and must never increase the base rubric total. Put them in adjustments, with a positive max_points magnitude and kind deduction or bonus. Include each rule once, even if repeated in the source.",
    "- Preserve each adjustment condition and any proof requirements in its description. Plagiarism or AI-use penalties requiring evidence must keep that requirement. Use adjustments: [] if there are no explicit point adjustments.",
    "- Assessment instructions and assignment requirements are valid criteria, even without points or a scoring table.",
    '- If the text contains no assessment criteria or requirements (for example, only a student essay), return { "criteria": [] }.',
    "- Do not invent criteria from an essay's topic, headings, claims, or citations.",
    "- Each criterion must include name, max_score, description.",
    "- max_score must be numeric. If missing, infer from rubric scale; if unclear, use 1.",
    "- description must be short and faithful.",
    "- No markdown. No extra keys. No extra text.",
    "",
    "Rubric text:",
    rubricText,
  ].join("\n");

  const startedAt = Date.now();
  let rubric: Rubric | undefined;
  let retryInstruction = "";
  const prepareRetry = (issues: { code: string; path: string }[]): string => {
    console.warn("RUBRIC_OUTPUT_RETRY", { requestId, attempt: 1, issues });
    return [
      "", "", "Re-extract the complete rubric from the original text: the previous response failed validation.",
      `Invalid fields: ${JSON.stringify(issues)}.`,
      "Return valid JSON with numeric point values, preserving the original base categories, explicit weights, stated total, and adjustment conditions.",
      "Check that base criterion weights sum to the stated total. Do not include total/subtotal rows or alternative performance levels as extra criteria. Keep deductions and bonuses separate.",
      "For multiple independent scoring tables, distinguish their section subtotals and course percentages from an overall raw-points total. If no overall raw-points total is stated for all extracted criteria, sum their actual row maxima, not the section-header denominators. Never change explicit row weights to fit an inconsistent section heading.",
      "Do not invent criteria or weights, rescale explicit weights, or replace a stated total to make validation pass. Re-read the original source and return the complete corrected extraction.",
    ].join("\n");
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let modelResult: unknown;
    try {
      modelResult = await (options.modelCaller ?? callStructureModel)(prompt + retryInstruction, { startedAt });
    } catch (error) {
      if (error instanceof Error && error.message === "OPENAI_TIMEOUT") {
        throw error;
      }
      const invalidJson = error instanceof Error && error.message === "MODEL_JSON_PARSE_FAILED";
      if (invalidJson && attempt === 0) {
        retryInstruction = prepareRetry([{ code: "invalid_json", path: "" }]);
        continue;
      }
      const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
      // Never log provider error bodies: they can contain input text or credentials.
      console.error("RUBRIC_MODEL_CALL_FAILED", {
        requestId,
        reason: invalidJson ? "invalid_json" : "provider_error",
        ...(typeof status === "number" ? { upstreamStatus: status } : {}),
      });
      throw new Error("RUBRIC_MODEL_UNAVAILABLE");
    }
    // Empty criteria is the model's explicit no-assessment signal. It may also
    // return total_score: 0/null; those fields must not turn guidance into a 500-like failure.
    if (modelResult && typeof modelResult === "object" && "criteria" in modelResult &&
        Array.isArray(modelResult.criteria) && modelResult.criteria.length === 0) {
      console.info("RUBRIC_CRITERIA_NOT_FOUND", { requestId });
      throw new Error("RUBRIC_CRITERIA_NOT_FOUND");
    }
    const parsed = RubricSchema.safeParse(modelResult);
    if (parsed.success) {
      rubric = parsed.data;
      break;
    }
    const issues = parsed.error.issues.map(issue => ({ code: issue.code, path: issue.path.join(".") }));
    if (attempt === 0) {
      retryInstruction = prepareRetry(issues);
      continue;
    }
    console.error("RUBRIC_SCHEMA_VALIDATION_FAILED", { requestId, issues });
    throw new Error("RUBRIC_STRUCTURE_FAILED");
  }
  if (!rubric) throw new Error("RUBRIC_STRUCTURE_FAILED");

  // Redis Lua cjson turns empty arrays into objects on a library metadata edit.
  if (rubric.adjustments?.length === 0) delete rubric.adjustments;
  if (cacheRedis && cacheKey) {
    try {
      await cacheRedis.set(cacheKey, JSON.stringify(rubric), { ex: RUBRIC_CACHE_TTL_SECONDS });
    } catch (cacheSetError) {
      const reason = classifyCacheSetFailure(cacheSetError);
      incrementCounter(cacheRedis, "rubric_cache_set_failed");
      console.warn("RUBRIC_STRUCT_CACHE_SET_FAILED", {
        requestId,
        reason,
        keyPrefix: cacheKey.slice(0, 32),
      });
      // Ignore cache write errors and return fresh model output.
    }
  }

  return rubric;
}
