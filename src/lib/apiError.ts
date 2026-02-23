import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export type ApiErrorBody = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

export type RequestContext = {
  requestId: string;
};

export function getRequestId(request: Request): string {
  const forwarded = request.headers.get("x-request-id")?.trim();
  if (forwarded) {
    return forwarded;
  }

  return randomUUID();
}

export function createRequestContext(request: Request): RequestContext {
  return {
    requestId: getRequestId(request),
  };
}

export function errorResponse(
  context: RequestContext,
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse<ApiErrorBody> {
  const baseHeaders = new Headers(headers);
  baseHeaders.set("x-request-id", context.requestId);

  return NextResponse.json(
    {
      code,
      message,
      requestId: context.requestId,
      ...(details === undefined ? {} : { details }),
    },
    { status, headers: baseHeaders },
  );
}

export function successJson<T>(context: RequestContext, body: T, headers?: HeadersInit): NextResponse<T> {
  const baseHeaders = new Headers(headers);
  baseHeaders.set("x-request-id", context.requestId);
  return NextResponse.json(body, { headers: baseHeaders });
}

export function logWithRequestId(context: RequestContext, event: string, payload?: unknown): void {
  if (payload === undefined) {
    console.error(event, { requestId: context.requestId });
    return;
  }

  console.error(event, {
    requestId: context.requestId,
    payload,
  });
}
