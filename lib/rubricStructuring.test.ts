import assert from "node:assert/strict";
import test from "node:test";
import { RubricSchema } from "./schema";

import {
  RUBRIC_CACHE_TTL_SECONDS,
  RUBRIC_CACHE_VERSION,
  hashNormalizedEmail,
  structureRubric,
} from "./rubricStructuring";

type RedisStub = {
  store: Map<string, string>;
  getCalls: string[];
  setCalls: Array<{ key: string; value: string; options?: { ex?: number } }>;
  incrCalls: string[];
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number }) => Promise<string>;
  incr: (key: string) => Promise<number>;
};

function createRedisStub(): RedisStub {
  const store = new Map<string, string>();
  const getCalls: string[] = [];
  const setCalls: Array<{ key: string; value: string; options?: { ex?: number } }> = [];
  const incrCalls: string[] = [];

  return {
    store,
    getCalls,
    setCalls,
    incrCalls,
    async get(key: string) {
      getCalls.push(key);
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, options?: { ex?: number }) {
      setCalls.push({ key, value, options });
      store.set(key, value);
      return "OK";
    },
    async incr(key: string) {
      incrCalls.push(key);
      return 1;
    },
  };
}

test("same user + same rubric hits cache and skips structuring model", async () => {
  const redis = createRedisStub();
  let modelCalls = 0;

  const cacheIdentity = { userIdType: "customer" as const, userIdValue: "cus_123" };
  const rubric = "  Criterion A\n\n\n  10 points  ";

  const first = await structureRubric(rubric, {
    cacheIdentity,
    cacheRedisOverride: redis,
    modelCaller: async () => {
      modelCalls += 1;
      return {
        criteria: [{ name: "Criterion A", max_score: 10, description: "Desc" }, { name: "Criterion B", max_score: 10, description: "Second criterion" }],
      };
    },
  });

  const second = await structureRubric(rubric, {
    cacheIdentity,
    cacheRedisOverride: redis,
    modelCaller: async () => {
      modelCalls += 1;
      return {
        criteria: [{ name: "Criterion A", max_score: 10, description: "Desc" }, { name: "Criterion B", max_score: 10, description: "Second criterion" }],
      };
    },
  });

  assert.equal(modelCalls, 1);
  assert.deepEqual(first, second);
  assert.equal(redis.getCalls.length, 2);
  assert.equal(redis.setCalls.length, 1);
  assert.equal(redis.setCalls[0]?.options?.ex, 604800);
  assert.ok(redis.getCalls[0]?.startsWith("rubric_struct_cache:v1:customer:cus_123:"));
});

test("different users + same rubric do not share cache", async () => {
  const redis = createRedisStub();
  let modelCalls = 0;

  const rubric = "Criterion A 10 points";
  const modelCaller = async () => {
    modelCalls += 1;
    return {
      criteria: [{ name: "Criterion A", max_score: 10, description: "Desc" }, { name: "Criterion B", max_score: 10, description: "Second criterion" }],
    };
  };

  await structureRubric(rubric, {
    cacheIdentity: { userIdType: "customer", userIdValue: "cus_1" },
    cacheRedisOverride: redis,
    modelCaller,
  });

  await structureRubric(rubric, {
    cacheIdentity: { userIdType: "customer", userIdValue: "cus_2" },
    cacheRedisOverride: redis,
    modelCaller,
  });

  assert.equal(modelCalls, 2);
  assert.equal(redis.getCalls.length, 2);
  assert.notEqual(redis.getCalls[0], redis.getCalls[1]);
});

test("no user identity skips cache key get/set operations", async () => {
  const redis = createRedisStub();
  let modelCalls = 0;

  await structureRubric("Criterion A", {
    cacheIdentity: null,
    cacheRedisOverride: redis,
    modelCaller: async () => {
      modelCalls += 1;
      return {
        criteria: [{ name: "Criterion A", max_score: 1, description: "Desc" }, { name: "Criterion B", max_score: 1, description: "Second criterion" }],
      };
    },
  });

  assert.equal(modelCalls, 1);
  assert.equal(redis.getCalls.length, 0);
  assert.equal(redis.setCalls.length, 0);
  assert.ok(redis.incrCalls.includes("rubric_cache_skipped_no_user"));
});

test("email hashing uses normalized email and key never stores raw email", async () => {
  const redis = createRedisStub();
  const rawEmail = " Student@Example.com ";
  const emailHash = hashNormalizedEmail(rawEmail);

  await structureRubric("Criterion A", {
    cacheIdentity: { userIdType: "emailhash", userIdValue: emailHash },
    cacheRedisOverride: redis,
    modelCaller: async () => ({
      criteria: [{ name: "Criterion A", max_score: 1, description: "Desc" }, { name: "Criterion B", max_score: 1, description: "Second criterion" }],
    }),
  });

  const usedKey = redis.getCalls[0] ?? redis.setCalls[0]?.key ?? "";
  assert.ok(usedKey.includes(`rubric_struct_cache:${RUBRIC_CACHE_VERSION}:emailhash:${emailHash}:`));
  assert.ok(!usedKey.toLowerCase().includes("student@example.com"));
});

test("ttl and cache version constants match policy", () => {
  assert.equal(RUBRIC_CACHE_TTL_SECONDS, 604800);
  assert.equal(RUBRIC_CACHE_VERSION, "v1");
});

const holisticRubric = {
  criteria: [{ name: "Overall quality", max_score: 100, description: "Clarity and support of the argument." }],
};

test("a single holistic criterion is a valid rubric and can be reused from cache", async () => {
  const redis = createRedisStub();
  const options = {
    cacheIdentity: { userIdType: "emailhash" as const, userIdValue: "test-user" },
    cacheRedisOverride: redis,
    modelCaller: async () => holisticRubric,
  };
  assert.deepEqual(await structureRubric("Overall quality: 100 points", options), holisticRubric);
  assert.deepEqual(await structureRubric("Overall quality: 100 points", {
    ...options, modelCaller: async () => { throw new Error("Cache should skip the model"); },
  }), holisticRubric);
});

test("cache accepts the deserialized objects returned by Upstash", async () => {
  const redis = createRedisStub();
  const result = await structureRubric("Overall quality: 100 points", {
    cacheIdentity: { userIdType: "emailhash", userIdValue: "test-user" },
    cacheRedisOverride: { ...redis, get: async () => holisticRubric },
    modelCaller: async () => { throw new Error("Cache should skip the model"); },
  });
  assert.deepEqual(result, holisticRubric);
  assert.ok(redis.incrCalls.includes("rubric_cache_hit"));
  assert.equal(redis.setCalls.length, 0);
});

test("empty criteria produce actionable input validation, never a fabricated or cached rubric", async () => {
  const redis = createRedisStub();
  const prompts: string[] = [];
  assert.equal(RubricSchema.safeParse({ criteria: [] }).success, false);
  await assert.rejects(structureRubric("An essay about a social issue, without assessment instructions.", {
    cacheIdentity: { userIdType: "emailhash", userIdValue: "empty-test" },
    cacheRedisOverride: redis,
    modelCaller: async prompt => { prompts.push(prompt); return { criteria: [] }; },
  }), { message: "RUBRIC_CRITERIA_NOT_FOUND" });
  assert.equal(redis.setCalls.length, 0);
  assert.match(prompts[0], /Do not invent criteria/);
});

test("invalid model shapes and invalid scores are still technical rubric failures", async () => {
  for (const invalid of [null, {}, { criteria: null }, { criteria: "" }, ...[0, -1, NaN, Infinity, "100"].map(max_score => ({ criteria: [{
    ...holisticRubric.criteria[0], max_score,
  }] }))]) {
    assert.equal(RubricSchema.safeParse(invalid).success, false);
    await assert.rejects(structureRubric("Unusable rubric", {
      cacheRedisOverride: null, modelCaller: async () => invalid,
    }), /RUBRIC_STRUCTURE_FAILED/);
  }
});

test("invalid cached rubrics are replaced by validated model output", async () => {
  for (const cached of [{ criteria: [] }, "not JSON"]) {
    const redis = createRedisStub();
    const result = await structureRubric("Overall quality: 100 points", {
      cacheIdentity: { userIdType: "emailhash", userIdValue: "test-user" },
      cacheRedisOverride: { ...redis, get: async () => cached },
      modelCaller: async () => holisticRubric,
    });
    assert.deepEqual(result, holisticRubric);
    assert.equal(redis.setCalls.length, 1);
  }
});

test("model failures remain distinguishable and diagnostics do not log private inputs", async t => {
  const logs = t.mock.method(console, "error", () => {});
  const secret = "private rubric text and provider response";
  for (const [error, code] of [
    [Object.assign(new Error(secret), { status: 429 }), "RUBRIC_MODEL_UNAVAILABLE"],
    [new Error("MODEL_JSON_PARSE_FAILED"), "RUBRIC_MODEL_UNAVAILABLE"],
    [new Error("OPENAI_TIMEOUT"), "OPENAI_TIMEOUT"],
  ] as const) {
    await assert.rejects(structureRubric(secret, {
      requestId: "diagnostic-test", cacheRedisOverride: null,
      modelCaller: async () => { throw error; },
    }), { message: code });
  }
  await assert.rejects(structureRubric(secret, {
    requestId: "diagnostic-test", cacheRedisOverride: null,
    modelCaller: async () => ({ criteria: [{ name: secret, max_score: secret, description: secret }] }),
  }), /RUBRIC_STRUCTURE_FAILED/);
  const diagnostics = logs.mock.calls.map(call => call.arguments);
  assert.equal(diagnostics.length, 3);
  assert.deepEqual(diagnostics[0], ["RUBRIC_MODEL_CALL_FAILED", {
    requestId: "diagnostic-test", reason: "provider_error", upstreamStatus: 429,
  }]);
  assert.deepEqual(diagnostics[2], ["RUBRIC_SCHEMA_VALIDATION_FAILED", {
    requestId: "diagnostic-test", issues: [{ code: "invalid_type", path: "criteria.0.max_score" }],
  }]);
  assert.ok(!JSON.stringify(diagnostics).includes(secret));
});
