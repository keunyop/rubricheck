import { NextResponse } from "next/server";

import { POST as gradePost } from "../grade/route";
import {
  getPayloadSizeApprox,
  recordAbuseTelemetry,
  shouldEnforceForSuspicious,
} from "../../../src/lib/abuseTelemetry";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const response = await gradePost(request);
  const requestId = response.headers.get("x-request-id") ?? "unknown";
  const telemetry = await recordAbuseTelemetry({
    requestId,
    endpoint: "evaluate",
    request,
    outcome: response.ok ? "success" : "error",
    latencyMs: Date.now() - startedAt,
    payloadSizeApprox: getPayloadSizeApprox(request),
    fileType: request.headers.get("content-type") ?? undefined,
  });

  if (shouldEnforceForSuspicious(telemetry.suspicious)) {
    return NextResponse.json(
      {
        code: "ABUSE_BLOCKED",
        message: "Request blocked by abuse controls.",
        requestId,
      },
      { status: 429, headers: { "x-request-id": requestId } },
    );
  }

  return response;
}
