import assert from "node:assert/strict";
import test from "node:test";

import { ensureMeaningfulText } from "./parse.ts";

test("ensureMeaningfulText throws for near-empty extracted text", () => {
  assert.throws(() => ensureMeaningfulText("short text", "sample.pdf"), /TEXT_EXTRACTION_FAILED/);
});
