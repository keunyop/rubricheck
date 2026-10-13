import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { LanguagePreferences } from "../../../../src/i18n/config.ts";
let email: string | null = "student@example.com", offline = false;
const stored = new Map<string, LanguagePreferences>();
mock.module("../../../../src/lib/creditSession.ts", { namedExports: { getCreditEmailFromCookie: () => email } });
mock.module("../../../../src/lib/languagePreferences.ts", { namedExports: {
  getLanguagePreferences: async (owner: string) => { if (offline) throw Error(); return stored.get(owner) ?? null; },
  saveLanguagePreferences: async (owner: string, value: LanguagePreferences) => { if (offline) throw Error(); stored.set(owner, value); },
} });
const { GET, PUT } = await import("./route.ts");
const url = "https://example.com/api/account/preferences";
const request = (body: unknown, origin = "https://example.com") => new Request(url, { method: "PUT", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
test("language preferences authenticate, persist independently and reject unsafe writes", async t => {
  await t.test("save and restore separate account defaults without caching", async () => {
    assert.equal((await GET(new Request(url))).status, 200);
    const value = { siteLanguage: "en", resultLanguage: "ko" };
    assert.equal((await PUT(request(value))).status, 200);
    const response = await GET(new Request(url));
    assert.deepEqual((await response.json()).preferences, value);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    email = "other@example.com";
    assert.equal((await (await GET(new Request(url))).json()).preferences, null);
    email = "student@example.com";
  });
  await t.test("invalid locale, identity injection and cross-origin requests cannot save", async () => {
    for (const body of [{ siteLanguage: "id", resultLanguage: "ko" }, { siteLanguage: "en" },
      { siteLanguage: "en", resultLanguage: "ko", email: "other@example.com" }])
      assert.equal((await PUT(request(body))).status, 400);
    assert.equal((await PUT(request({ siteLanguage: "ms", resultLanguage: "ms" }, "https://evil.example"))).status, 403);
    assert.deepEqual(stored.get(email!), { siteLanguage: "en", resultLanguage: "ko" });
  });
  await t.test("storage failures return errors without pretending to save", async () => {
    offline = true;
    assert.equal((await PUT(request({ siteLanguage: "ms", resultLanguage: "ms" }))).status, 503);
    assert.equal((await GET(new Request(url))).status, 503);
    offline = false;
  });
  await t.test("signed-out requests cannot read or change a user's preferences", async () => {
    email = null;
    assert.equal((await GET(new Request(url))).status, 401);
    assert.equal((await PUT(request({ siteLanguage: "en", resultLanguage: "ko" }))).status, 401);
  });
});
