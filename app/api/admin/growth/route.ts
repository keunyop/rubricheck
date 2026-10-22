import { NextResponse } from "next/server";
import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { growthEnabled } from "../../../../src/lib/growthServer";
import { callSupabaseRpc } from "../../../../src/lib/supabaseRest";
import { summarizeGrowth, type GrowthSnapshot } from "../../../../src/lib/growthReport";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  if (!growthEnabled()) return NextResponse.json({ available: false, reason: "Growth measurement is not enabled. Apply the migration and configure the feature flag first." }, { headers });
  const raw = new URL(request.url).searchParams.get("days") ?? "30";
  if (!["7","14","30","60","89"].includes(raw)) return NextResponse.json({ error: "INVALID_WINDOW" }, {status:400,headers});
  const to = new Date().toISOString(), from = new Date(Date.parse(to)-Number(raw)*86400000).toISOString();
  try {
    const snapshot = await callSupabaseRpc<GrowthSnapshot>("rubricheck_growth_report", {p_from:from,p_to:to});
    return NextResponse.json({ available:true, ...summarizeGrowth(snapshot,from,to) }, {headers});
  } catch { return NextResponse.json({ available:false,reason:"Growth data is unavailable. Check the migration and server configuration." }, {status:503,headers}); }
}
