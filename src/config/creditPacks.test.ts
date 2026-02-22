import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreditsForCreditPack,
  getCreditPackMarketingLabel,
  getCreditPackPriceLabel,
  getLookupKeyForCreditPack,
  normalizeCreditPackId,
  resolveCreditPackIdFromLookupKey,
} from "./creditPacks.ts";

test("credit pack id maps to expected lookup_key and credit amount", () => {
  assert.equal(getLookupKeyForCreditPack("10"), "credits_10_v1");
  assert.equal(getLookupKeyForCreditPack("25"), "credits_25_v1");
  assert.equal(getLookupKeyForCreditPack("60"), "credits_60_v1");

  assert.equal(getCreditsForCreditPack("10"), 10);
  assert.equal(getCreditsForCreditPack("25"), 25);
  assert.equal(getCreditsForCreditPack("60"), 60);
});

test("credit pack lookup_key resolves back to pack id", () => {
  assert.equal(resolveCreditPackIdFromLookupKey("credits_10_v1"), "10");
  assert.equal(resolveCreditPackIdFromLookupKey("credits_25_v1"), "25");
  assert.equal(resolveCreditPackIdFromLookupKey("credits_60_v1"), "60");
  assert.equal(resolveCreditPackIdFromLookupKey("unknown"), null);
});

test("normalizeCreditPackId validates accepted pack ids", () => {
  assert.equal(normalizeCreditPackId("10"), "10");
  assert.equal(normalizeCreditPackId("25"), "25");
  assert.equal(normalizeCreditPackId("60"), "60");
  assert.equal(normalizeCreditPackId("15"), null);
});

test("credit pack marketing and price labels are configured for interstitial cards", () => {
  assert.equal(getCreditPackMarketingLabel("10"), "Starter");
  assert.equal(getCreditPackMarketingLabel("25"), "Most Popular");
  assert.equal(getCreditPackMarketingLabel("60"), "Best Value");
  assert.equal(getCreditPackPriceLabel("10"), "$4.99");
  assert.equal(getCreditPackPriceLabel("25"), "$9.99");
  assert.equal(getCreditPackPriceLabel("60"), "$19.99");
});
