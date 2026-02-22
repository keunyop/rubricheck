import { NextResponse } from "next/server";

import { getCreditBalanceForRequest } from "../../../src/lib/credits";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const balance = await getCreditBalanceForRequest(request);
    return NextResponse.json({
      balance,
      hasIdentity: balance !== null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING") {
      return NextResponse.json({ balance: null, hasIdentity: false }, { status: 200 });
    }

    console.error("CREDITS_BALANCE_FETCH_FAILED", error);
    return NextResponse.json({ error: "CREDITS_BALANCE_FETCH_FAILED" }, { status: 500 });
  }
}
