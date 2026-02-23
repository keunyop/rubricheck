import assert from "node:assert/strict";
import test from "node:test";

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
        criteria: [{ name: "Criterion A", max_score: 10, description: "Desc" }],
      };
    },
  });

  const second = await structureRubric(rubric, {
    cacheIdentity,
    cacheRedisOverride: redis,
    modelCaller: async () => {
      modelCalls += 1;
      return {
        criteria: [{ name: "Criterion A", max_score: 10, description: "Desc" }],
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
      criteria: [{ name: "Criterion A", max_score: 10, description: "Desc" }],
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
        criteria: [{ name: "Criterion A", max_score: 1, description: "Desc" }],
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
      criteria: [{ name: "Criterion A", max_score: 1, description: "Desc" }],
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
