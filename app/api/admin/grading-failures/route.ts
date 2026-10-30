import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { deleteGradingFailure, deleteGradingFailuresForAccount, getGradingFailure, listGradingFailures, validFailureId } from "../../../../src/lib/gradingFailures";
import { z } from "zod";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function authorized(request: Request) {
  try { return isAdminAuthorized(request); } catch { return false; }
}

export async function GET(request: Request) {
  const context = createRequestContext(request);
  if (!authorized(request)) return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.", undefined, headers);
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  try {
    if (id !== null) {
      if (!validFailureId(id)) return errorResponse(context, 400, "INVALID_ID", "Invalid failure record.", undefined, headers);
      const record = await getGradingFailure(id);
      if (!record) return errorResponse(context, 404, "FAILURE_NOT_FOUND", "This record has expired or was deleted.", undefined, headers);
      const fileIndex = params.get("file");
      if (fileIndex !== null) {
        const index = Number(fileIndex);
        if (!/^\d+$/.test(fileIndex) || !Number.isSafeInteger(index) || !record.files[index] || typeof record.fileContents[index] !== "string") {
          return errorResponse(context, 404, "FILE_NOT_FOUND", "The original file is unavailable.", undefined, headers);
        }
        const bytes = Buffer.from(record.fileContents[index], "base64");
        if (bytes.length !== record.files[index].size) throw new Error("FILE_INCOMPLETE");
        console.info("ADMIN_GRADING_FAILURE_DOWNLOAD", { id, file: index });
        return new Response(bytes, { headers: {
          ...headers, "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="original-${index}"; filename*=UTF-8''${encodeURIComponent(record.files[index].name).replace(/'/g, "%27")}`,
          "Content-Security-Policy": "default-src 'none'; sandbox",
        } });
      }
      // Binary contents are served only by the explicit attachment endpoint.
      const { fileContents, ...detail } = record;
      if (record.captureStatus === "complete" && fileContents.length !== record.files.length) throw new Error("FILES_INCOMPLETE");
      console.info("ADMIN_GRADING_FAILURE_READ", { id });
      if (params.get("download") === "1") return new Response(JSON.stringify(detail, null, 2), { headers: {
        ...headers, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="grading-failure-${id}.json"`,
      } });
      return successJson(context, detail, headers);
    }
    const raw = params.get("offset") ?? "0";
    const offset = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(offset) || offset < 0) return errorResponse(context, 400, "INVALID_OFFSET", "Invalid page.", undefined, headers);
    return successJson(context, await listGradingFailures(offset), headers);
  } catch {
    console.warn("ADMIN_GRADING_FAILURE_READ_FAILED", { requestId: context.requestId });
    return errorResponse(context, 503, "FAILURES_UNAVAILABLE", "Unable to load grading failures. Please retry.", undefined, headers);
  }
}

const deleteSchema = z.union([
  z.object({ id: z.string().refine(validFailureId) }).strict(),
  z.object({ email: z.string().trim().email().max(254) }).strict(),
]);
export async function DELETE(request: Request) {
  const context = createRequestContext(request);
  if (!authorized(request)) return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.", undefined, headers);
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.slice(0, -1);
  if (origin && origin !== protocol + "://" + host) return errorResponse(context, 403, "FORBIDDEN", "Use the admin dashboard to delete records.", undefined, headers);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return errorResponse(context, 415, "INVALID_CONTENT_TYPE", "Send JSON.", undefined, headers);
  let body: unknown;
  try {
    if (Number(request.headers.get("content-length")) > 1024) throw new Error();
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024) throw new Error();
    body = JSON.parse(raw);
  } catch { return errorResponse(context, 400, "INVALID_INPUT", "Choose a record or account to delete.", undefined, headers); }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return errorResponse(context, 400, "INVALID_INPUT", "Choose a record or account to delete.", undefined, headers);
  try {
    if ("id" in parsed.data) await deleteGradingFailure(parsed.data.id);
    else await deleteGradingFailuresForAccount(parsed.data.email);
    console.info("ADMIN_GRADING_FAILURE_DELETED", { requestId: context.requestId, scope: "id" in parsed.data ? "record" : "account" });
    return successJson(context, { ok: true }, headers);
  } catch {
    return errorResponse(context, 503, "DELETE_FAILED", "Could not delete the record. Please retry.", undefined, headers);
  }
}
