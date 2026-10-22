import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleTagQueue } from "./googleTag.ts";

test("Google commands use the Arguments-object protocol expected by gtag.js", () => {
  const entries: IArguments[] = [];
  const tag = createGoogleTagQueue(entry => entries.push(entry));
  const timestamp = new Date();
  const config = { send_page_view: false };
  const page = { page_location: "https://rubricheck.com/pricing" };
  tag("js", timestamp);
  tag("config", "G-EXAMPLE", config);
  tag("event", "page_view", page);
  assert.deepEqual(entries.map(entry => Object.prototype.toString.call(entry)), ["[object Arguments]", "[object Arguments]", "[object Arguments]"]);
  assert.ok(entries.every(entry => !Array.isArray(entry)));
  assert.deepEqual(entries.map(entry => Array.from(entry)), [["js", timestamp], ["config", "G-EXAMPLE", config], ["event", "page_view", page]]);
});
