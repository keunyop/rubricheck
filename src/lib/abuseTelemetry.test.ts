import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSuspicion,
  extractClientIp,
  hashEmail,
} from "./abuseTelemetry";

test("extractClientIp prefers first x-forwarded-for ip", () => {
  const request = new Request("http://localhost/test", {
    headers: {
      "x-forwarded-for": "203.0.113.1, 198.51.100.2",
      "x-real-ip": "192.0.2.5",
    },
  });

  assert.equal(extractClientIp(request), "203.0.113.1");
});

test("hashEmail normalizes and does not contain raw email", () => {
  const raw = "Student+One@Example.com";
  const hashed = hashEmail(raw);

  assert.notEqual(hashed, "");
  assert.notEqual(hashed, raw);
  assert.equal(hashed.includes("example.com"), false);
  assert.equal(hashed, hashEmail("student+one@example.com"));
});

test("suspicion scoring flags high request rate on same IP", () => {
  const result = evaluateSuspicion({
    endpoint: "evaluate",
    uaLength: 40,
    ratePerMinute: 11,
    distinctEmailsPerIp10m: 0,
    distinctIpsPerEmail10m: 0,
    ipErrorTotal10m: 0,
    ipRequestTotal10m: 1,
  });

  assert.equal(result.reasons.includes("high_rate_same_ip"), true);
});

test("suspicion scoring flags many distinct emails per ip", () => {
  const result = evaluateSuspicion({
    endpoint: "otp_start",
    uaLength: 40,
    ratePerMinute: 1,
    distinctEmailsPerIp10m: 6,
    distinctIpsPerEmail10m: 0,
    ipErrorTotal10m: 0,
    ipRequestTotal10m: 1,
  });

  assert.equal(result.reasons.includes("many_distinct_emails_per_ip"), true);
});

test("suspicion scoring flags many ips per email", () => {
  const result = evaluateSuspicion({
    endpoint: "otp_verify",
    uaLength: 40,
    ratePerMinute: 1,
    distinctEmailsPerIp10m: 0,
    distinctIpsPerEmail10m: 7,
    ipErrorTotal10m: 0,
    ipRequestTotal10m: 1,
  });

  assert.equal(result.reasons.includes("many_ips_per_email"), true);
});
