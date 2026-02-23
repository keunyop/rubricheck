import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

import { callStructureModel } from "./openai";
import { RubricSchema, type Rubric } from "./schema";

export const RUBRIC_CACHE_VERSION = "v1";
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
  modelCaller?: (prompt: string) => Promise<unknown>;
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
  return rubricText.replace(/\r\n?/g, "\n").trim().replace(/[\t\f\v ]+/g, " ").replace(/\n{3,}/g, "\n\n");
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
      if (typeof cached === "string") {
        const parsedCached = RubricSchema.safeParse(JSON.parse(cached));
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
        reason: cacheGetError instanceof Error ? cacheGetError.message : "unknown",
        keyPrefix: cacheKey.slice(0, 32),
      });
      incrementCounter(cacheRedis, "rubric_cache_miss");
      // Ignore cache read errors and continue with model call.
    }
  }

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
    const modelResult = await (options.modelCaller ?? callStructureModel)(prompt);
    const parsed = RubricSchema.safeParse(modelResult);

    if (!parsed.success) {
      throw new Error("RUBRIC_STRUCTURE_FAILED");
    }

    if (cacheRedis && cacheKey) {
      try {
        await cacheRedis.set(cacheKey, JSON.stringify(parsed.data), { ex: RUBRIC_CACHE_TTL_SECONDS });
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

    return parsed.data;
  } catch {
    throw new Error("RUBRIC_STRUCTURE_FAILED");
  }
}
