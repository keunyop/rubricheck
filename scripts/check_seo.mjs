import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

// Run after npm run build. Starts and stops an isolated local production server;
// does not submit forms, call evaluation/checkout, or change production state.
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = "http://127.0.0.1:" + port;
let serverOutput = "";
const server = spawn(process.execPath, [
  "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port),
], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });
let serverError;
server.on("error", (error) => { serverError = error; });

const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2].replaceAll("&amp;", "&")]),
);
const tags = (html, tag) => [...html.matchAll(new RegExp("<" + tag + "\\b[^>]*>", "g"))].map((match) => attributes(match[0]));
const meta = (html, name) => tags(html, "meta").find((tag) => tag.name === name || tag.property === name)?.content;
const canonical = (html) => tags(html, "link").filter((tag) => tag.rel === "canonical");
const publicOrigin = "https://rubricheck.com";
const get = (path, options = {}) => fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15000), ...options });

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error("Local server exited: " + serverOutput);
    try {
      if ((await get("/robots.txt")).ok) { ready = true; break; }
    } catch { /* Wait for the local server to start. */ }
    await delay(250);
  }
  assert.ok(ready, "Local production server started");

  const robots = await (await get("/robots.txt")).text();
  assert.match(robots, /Sitemap: https:\/\/rubricheck\.com\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/(?:admin|billing|_next|essay|rubric)/, "noindex pages and public assets remain crawlable");

  const sitemapResponse = await get("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]));
  assert.ok(urls.length >= 8, "Sitemap includes the public product and guide pages");
  assert.equal(new Set(urls.map(String)).size, urls.length, "No duplicate sitemap URLs");
  assert.doesNotMatch(sitemap, /<loc>[^<]*\/(?:api|admin|billing)(?:\/|<)/);
  const titles = new Set();
  const descriptions = new Set();
  const pages = new Map();

  for (const url of urls) {
    assert.equal(url.origin, publicOrigin);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    const response = await get(url.pathname);
    assert.equal(response.status, 200, url.pathname + " must not redirect or fail");
    assert.doesNotMatch(response.headers.get("x-robots-tag") || "", /noindex/);
    const html = await response.text();
    pages.set(url.pathname, html);
    assert.match(html, /<html[^>]+lang="en"/);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, url.pathname + " has one rendered H1");
    assert.equal(canonical(html).length, 1, url.pathname + " has one canonical");
    assert.equal(new URL(canonical(html)[0].href).href, url.href);
    assert.doesNotMatch(meta(html, "robots") || "", /noindex/);
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    const description = meta(html, "description");
    assert.ok(title && description, url.pathname + " has title and description");
    assert.ok(!titles.has(title), "Distinct page title: " + url.pathname);
    assert.ok(!descriptions.has(description), "Distinct description: " + url.pathname);
    titles.add(title);
    descriptions.add(description);
    assert.equal(new URL(meta(html, "og:url")).href, url.href);
    assert.ok(meta(html, "og:title") && meta(html, "twitter:title"));
    assert.equal(meta(html, "og:description"), description);
    assert.equal(meta(html, "twitter:description"), description);
    assert.ok(meta(html, "og:image") && meta(html, "twitter:image"), "Complete social metadata");

    const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
    const apps = schemas.filter((schema) => schema["@type"] === "SoftwareApplication");
    assert.equal(apps.length, url.pathname === "/" ? 1 : 0, "One application entity on its actual page");
    const ids = schemas.map((schema) => schema["@id"]).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, "No repeated structured-data entity definitions");
    const breadcrumb = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
    if (breadcrumb) {
      assert.match(html, /aria-label="Breadcrumb"/, "Breadcrumbs are visible as well as marked up");
      assert.equal(breadcrumb.itemListElement.length, 2);
      breadcrumb.itemListElement.forEach((item, index) => assert.equal(item.position, index + 1));
      assert.equal(breadcrumb.itemListElement[0].item, publicOrigin + "/");
      assert.equal(breadcrumb.itemListElement.at(-1).item, url.href);
      assert.match(html, /<table\b/, "Guide includes a rendered worked example");
    }
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
    assert.doesNotMatch(visible, /SEO entry points|search intent|close to conversion|transactional page|keyword cluster|SEO themes/);
  }

  const home = pages.get("/");
  assert.match(home, /id="rubric-checker"/);
  for (const path of pages.keys()) {
    if (path !== "/" && !path.startsWith("/legal/") && path !== "/pricing") {
      assert.ok(tags(home, "a").some((tag) => tag.href === path), "Homepage links to " + path);
    }
  }
  for (const [path, html] of pages) {
    for (const link of tags(html, "a")) {
      if (!link.href?.startsWith("/") || link.href.startsWith("//")) continue;
      const destination = new URL(link.href, publicOrigin);
      if (destination.pathname.startsWith("/billing/")) continue;
      assert.ok(pages.has(destination.pathname), path + " links to a known public page: " + link.href);
      if (destination.hash === "#rubric-checker") assert.match(home, /id="rubric-checker"/);
    }
  }
  const parameterHtml = await (await get("/essay-rubric-checker?utm_source=seo-test")).text();
  assert.equal(canonical(parameterHtml)[0].href, publicOrigin + "/essay-rubric-checker");

  const ogImageUrl = new URL(meta(home, "og:image"));
  assert.equal(ogImageUrl.origin, publicOrigin, "OG image uses the canonical domain");
  const imageResponse = await get(ogImageUrl.pathname + ogImageUrl.search);
  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("content-type"), /image\/png/);
  const png = Buffer.from(await imageResponse.arrayBuffer());
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);

  for (const path of ["/billing/manage", "/billing/cancel"]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.match(meta(await response.text(), "robots"), /noindex/);
  }
  for (const path of ["/admin", "/admin/abuse", "/api/__seo_probe__"]) {
    const response = await get(path);
    assert.match(response.headers.get("x-robots-tag"), /noindex/, path + " has an HTTP indexing exclusion");
  }

  for (const headers of [
    { "x-forwarded-host": "www.rubricheck.com", "x-forwarded-proto": "https" },
    { "x-forwarded-host": "rubricheck.com", "x-forwarded-proto": "http" },
  ]) {
    const response = await get("/essay-rubric-checker?utm_source=redirect-test", { headers });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), publicOrigin + "/essay-rubric-checker?utm_source=redirect-test");
  }
  const missing = await get("/__seo_page_that_does_not_exist__");
  assert.equal(missing.status, 404, "Unknown URLs return a real 404");

  console.log("SEO checks passed for " + urls.length + " public pages: rendered content, unique metadata, canonical URLs, internal links, structured data, sitemap, robots, noindex, redirects, 404, and 1200x630 OG image.");
} catch (error) {
  console.error(serverOutput.slice(-3000));
  throw error;
} finally {
  if (server.exitCode === null && server.pid) {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
  }
}
