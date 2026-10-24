import assert from "node:assert/strict";
import test from "node:test";

import { assertPatchedNode } from "./nodeRuntime.mjs";

test("runtime guard rejects affected Node.js 24 releases", () => {
  for (const version of ["24.13.0", "24.21.9", "24.22.0"]) {
    assert.throws(() => assertPatchedNode(version), /requires Node.js >=24\.22\.1 <25/);
  }
});

test("runtime guard accepts the security release and later stable Node.js 24 versions", () => {
  for (const version of ["24.22.1", "24.22.2", "24.23.0"]) {
    assert.doesNotThrow(() => assertPatchedNode(version));
  }
});

test("runtime guard rejects unsupported majors and unverified version strings", () => {
  for (const version of ["20.20.0", "22.23.4", "26.12.1", "24.22.1-rc.1", "24.22", "garbage", ""]) {
    assert.throws(() => assertPatchedNode(version));
  }
});
