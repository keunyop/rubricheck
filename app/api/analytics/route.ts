import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { GROWTH_CLIENT_EVENTS, sameGrowthOrigin, sanitizeTouch, validGrowthId } from "../../../src/lib/growth";
import { GROWTH_COOKIE, growthAccount, growthConsent, growthEnabled, growthHash, growthRpc, growthVisitor, recordGrowthEvent, setGrowthVisitor } from "../../../src/lib/growthServer";

export async function DELETE(request: Request) {
  if (!sameGrowthOrigin(request)) return new NextResponse(null, {status:403});
  // Cookie removal succeeds even when analytics storage is unavailable.
  if (growthEnabled()) {
    try { await growthRpc("rubricheck_growth_opt_out", { p_account: growthAccount(request), p_visitor: growthVisitor(request) }); } catch { console.warn("GROWTH_OPT_OUT_FAILED"); }
  }
  const response = new NextResponse(null, {status:204,headers:{"Cache-Control":"private, no-store"}});
  response.cookies.set(GROWTH_COOKIE,"",{httpOnly:true,path:"/",maxAge:0,sameSite:"lax",secure:process.env.NODE_ENV==="production"});
  return response;
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!growthEnabled() || !growthConsent(request)) return new NextResponse(null, { status: 204, headers });
  if (!sameGrowthOrigin(request) || !request.headers.get("content-type")?.startsWith("application/json")) return new NextResponse(null, { status: 403, headers });
  try {
    // No request bodies or IPs are logged. Bound bytes even without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return new NextResponse(null, { status: 400, headers });
    let length = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 4096) { await reader.cancel(); return new NextResponse(null, { status: 413, headers }); } chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return new NextResponse(null, { status: 400, headers });
    if (!GROWTH_CLIENT_EVENTS.includes(data.name) || !validGrowthId(data.id)) return new NextResponse(null, { status: 400, headers });
    // Reuse existing Redis; fail closed if rate-limit storage is unavailable.
    const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const redis = Redis.fromEnv();
    const key = `rubricheck:growth:rate:${growthHash("rate:" + ip)}:${Math.floor(Date.now() / 60000)}`;
    const count = await redis.incr(key); if (count === 1) await redis.expire(key, 120);
    if (count > 60) return new NextResponse(null, { status: 429, headers });
    const visitor = growthVisitor(request) ?? randomUUID();
    await recordGrowthEvent(request, { name: data.name, key: `client:${visitor}:${data.id}`, visitor, attempt: data.attempt, evaluation: data.evaluation, failure: data.name === "evaluation_network_failed" ? "network" : null, touch: data.name === "page_view" && data.touch ? sanitizeTouch(data.touch) : undefined });
    const response = new NextResponse(null, { status: 204, headers });
    if (!growthVisitor(request)) setGrowthVisitor(response, visitor);
    return response;
  } catch { return new NextResponse(null, { status: 503, headers }); }
}
