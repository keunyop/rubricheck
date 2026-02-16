import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

import { callStructureModel } from "./openai";
import { RubricSchema, type Rubric } from "./schema";

const RUBRIC_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
let cacheRedisClient: Redis | null | undefined;

function getOptionalCacheRedisClient(): Redis | null {
  if (cacheRedisClient !== undefined) {
    return cacheRedisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    cacheRedisClient = null;
    return cacheRedisClient;
  }

  cacheRedisClient = new Redis({ url, token });
  return cacheRedisClient;
}

function buildRubricCacheKey(rubricText: string): string {
  const structureModel = process.env.STRUCTURE_MODEL ?? "unknown";
  const normalizedText = rubricText.trim();
  const hash = createHash("sha256").update(normalizedText).digest("hex");
  return `rubricheck:cache:structured-rubric:${structureModel}:${hash}`;
}

export async function structureRubric(rubricText: string): Promise<Rubric> {
  const cacheRedis = getOptionalCacheRedisClient();
  const cacheKey = buildRubricCacheKey(rubricText);

  if (cacheRedis) {
    try {
      const cached = await cacheRedis.get<string>(cacheKey);
      if (typeof cached === "string") {
        const parsedCached = RubricSchema.safeParse(JSON.parse(cached));
        if (parsedCached.success) {
          return parsedCached.data;
        }
      }
    } catch {
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
    const modelResult = await callStructureModel(prompt);
    const parsed = RubricSchema.safeParse(modelResult);

    if (!parsed.success) {
      throw new Error("RUBRIC_STRUCTURE_FAILED");
    }

    if (cacheRedis) {
      try {
        await cacheRedis.set(cacheKey, JSON.stringify(parsed.data), {
          ex: RUBRIC_CACHE_TTL_SECONDS,
        });
      } catch {
        // Ignore cache write errors and return fresh model output.
      }
    }

    return parsed.data;
  } catch {
    throw new Error("RUBRIC_STRUCTURE_FAILED");
  }
}
