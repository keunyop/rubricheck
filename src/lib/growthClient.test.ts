import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { analyticsAllowed, flushGrowth, trackGrowth } from "./growthClient.ts";

test("client analytics starts without a choice cookie and respects opt-outs and privacy signals", () => {
  const descriptors = ["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const document = { cookie: "" };
  const navigator = { doNotTrack: "0", globalPrivacyControl: false };
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "document", { configurable: true, value: document });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
    assert.equal(analyticsAllowed(), true);
    document.cookie = "other=value; rubricheck_analytics=denied";
    assert.equal(analyticsAllowed(), false);
    document.cookie = "";
    navigator.doNotTrack = "1";
    assert.equal(analyticsAllowed(), false);
    navigator.doNotTrack = "0";
    navigator.globalPrivacyControl = true;
    assert.equal(analyticsAllowed(), false);
    navigator.globalPrivacyControl = false;
    document.cookie = "rubricheck_analytics=granted";
    assert.equal(analyticsAllowed(), true);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("unresponsive analytics cannot block an evaluation indefinitely", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {configurable:true,value:{}});
  Object.defineProperty(globalThis, "document", {configurable:true,value:{cookie:"",documentElement:{dataset:{growthEnabled:"true"}}}});
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
