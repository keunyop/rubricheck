import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { flushGrowth, trackGrowth } from "./growthClient.ts";

test("unresponsive analytics cannot block an evaluation indefinitely", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {configurable:true,value:{}});
  Object.defineProperty(globalThis, "document", {configurable:true,value:{cookie:"rubricheck_analytics=granted",documentElement:{dataset:{growthEnabled:"true"}}}});
  const fetch = mock.method(globalThis, "fetch", () => new Promise<Response>(() => {}));
  try {
    trackGrowth("evaluation_network_failed");
    const started = Date.now();
    await flushGrowth();
    assert.equal(fetch.mock.calls.length, 1);
    assert.ok(Date.now() - started < 3000);
  } finally {
    fetch.mock.restore();
    if (previousWindow) Object.defineProperty(globalThis,"window",previousWindow); else Reflect.deleteProperty(globalThis,"window");
    if (previousDocument) Object.defineProperty(globalThis,"document",previousDocument); else Reflect.deleteProperty(globalThis,"document");
  }
});
