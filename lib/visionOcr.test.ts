import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFile } from "./parse.ts";

const text = "Synthetic assignment text with evidence, analysis, and a clear conclusion. ".repeat(5).trim();
const file = new File(["synthetic image bytes"], "private-student-name.jpeg", { type: "image/jpeg" });

test("Google Vision request and failure handling", async (t) => {
  const previousEnv = { ...process.env };
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  let reply = () => Promise.resolve(Response.json({ responses: [{ fullTextAnnotation: { text } }] }));
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    init?.signal?.throwIfAborted();
    return reply();
  });
  process.env.GOOGLE_CLOUD_VISION_API_KEY = "  secret-test-key  ";
  delete process.env.GOOGLE_VISION_LANGUAGE_HINTS;
  t.beforeEach(() => { process.env.GOOGLE_CLOUD_VISION_API_KEY = "secret-test-key"; });
  try {
    await t.test("extracts both field types and sends credentials only in a header", async () => {
      for (const field of ["rubric", "assignment"] as const) {
        assert.equal(await parseFile(file, { field }), text);
        const request = requests.at(-1)!;
        assert.equal(request.url, "https://vision.googleapis.com/v1/images:annotate");
        assert.equal(new Headers(request.init?.headers).get("x-goog-api-key"), "secret-test-key");
        assert.ok(request.init?.signal instanceof AbortSignal);
        const body = JSON.parse(String(request.init?.body));
        assert.equal(body.requests[0].image.content, Buffer.from(await file.arrayBuffer()).toString("base64"));
        assert.equal(body.requests[0].features[0].type, field === "rubric" ? "DOCUMENT_TEXT_DETECTION" : "TEXT_DETECTION");
        assert.deepEqual(body.requests[0].imageContext.languageHints, ["en", "ko"]);
      }
    });
    await t.test("invalid API keys remain service errors with safe actionable diagnostics", async () => {
      logs.length = 0;
      reply = async () => Response.json({ error: { code: 400, message: "secret-test-key private input", details: [{ reason: "API_KEY_INVALID", metadata: { secret: "private input" } }] } }, { status: 400 });
      await assert.rejects(parseFile(file), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      assert.equal(logs[0][0], "GOOGLE_VISION_OCR_FAILED");
      assert.deepEqual(logs[0][1], { field: "assignment", reason: "provider_error", httpStatus: 400, providerReason: "API_KEY_INVALID" });
      assert.doesNotMatch(JSON.stringify(logs), /secret-test-key|private input|private-student-name/);
    });
    await t.test("missing configuration fails before any network call", async () => {
      delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
      const count = requests.length;
      await assert.rejects(parseFile(file), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      assert.equal(requests.length, count);
      assert.equal((logs.at(-1)?.[1] as { reason: string }).reason, "missing_api_key");
      process.env.GOOGLE_CLOUD_VISION_API_KEY = "secret-test-key";
    });
    await t.test("HTTP failures, malformed JSON, malformed responses and transport failures stay service errors", async () => {
      const replies = [
        ...[401, 403, 429, 500, 503].map(status => async () => new Response("private upstream error", { status })),
        async () => new Response("not JSON"),
        ...[null, {}, { responses: [] }, { responses: [null] }, { responses: "invalid" }, { responses: [{ fullTextAnnotation: { text: 123 } }] }].map(body => async () => Response.json(body)),
        async () => { throw new Error("private transport error with secret-test-key"); },
        async () => { throw new DOMException("timeout", "TimeoutError"); },
      ];
      for (const response of replies) {
        reply = response;
        await assert.rejects(parseFile(file), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      }
      assert.doesNotMatch(JSON.stringify(logs), /private|secret-test-key/);
    });
    await t.test("per-image INVALID_ARGUMENT uses the RPC code and reports an unreadable file", async () => {
      reply = async () => Response.json({ responses: [{ error: { code: 3, message: "Invalid image data" } }] });
      await assert.rejects(parseFile(file), /TEXT_EXTRACTION_FAILED/);
    });
    await t.test("the OCR deadline aborts stalled requests without exposing provider details", async (deadlineTest) => {
      deadlineTest.mock.method(AbortSignal, "timeout", (ms: number) => {
        assert.equal(ms, 20_000);
        return AbortSignal.abort(new DOMException("private timeout details", "TimeoutError"));
      });
      await assert.rejects(parseFile(file), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      assert.deepEqual(logs.at(-1), ["GOOGLE_VISION_OCR_FAILED", { field: "assignment", reason: "timeout" }]);
    });
    await t.test("per-image quota, authentication and provider failures stay service errors", async () => {
      for (const code of [4, 7, 8, 13, 14, 16]) {
        reply = async () => Response.json({ responses: [{ error: { code, message: "private input" } }] });
        await assert.rejects(parseFile(file), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      }
    });
    await t.test("empty and short text remain unreadable while multi-image parts can be short", async () => {
      reply = async () => Response.json({ responses: [{}] });
      await assert.rejects(parseFile(file), /TEXT_EXTRACTION_FAILED/);
      reply = async () => Response.json({ responses: [{ textAnnotations: [{ description: "Short image text" }] }] });
      await assert.rejects(parseFile(file), /TEXT_EXTRACTION_FAILED/);
      assert.equal(await parseFile(file, { requireMeaningfulText: false }), "Short image text");
    });
    await t.test("fallback annotations and explicit language hints are preserved", async () => {
      process.env.GOOGLE_VISION_LANGUAGE_HINTS = " en, ms, ,ko ";
      reply = async () => Response.json({ responses: [{ textAnnotations: [{ description: text }] }] });
      assert.equal(await parseFile(file), text);
      assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)).requests[0].imageContext.languageHints, ["en", "ms", "ko"]);
    });
  } finally {
    process.env = previousEnv;
  }
});
