import { z } from "zod";
import { LabError, requireLabEmail } from "./access";
import { resolveLabUser } from "./store";

export const labId = z.string().uuid();
export const labText = z.string().trim().min(1).max(60000);
export const labHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function labBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new LabError(415, "INVALID_TYPE", "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new LabError(400, "INVALID_INPUT", "Please provide valid inputs.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 600000) { await reader.cancel(); throw new LabError(413, "INPUT_TOO_LARGE", "Text input is too large."); }
    chunks.push(value);
  }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new LabError(400, "INVALID_INPUT", "Please provide valid inputs."); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new LabError(400, "INVALID_INPUT", "Check the inputs. Text is limited to 60,000 characters per field.");
  return parsed.data;
}

export function labRoute(handler: (request: Request, owner: string, email: string) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      const email = requireLabEmail(request);
      return await handler(request, await resolveLabUser(email), email);
    } catch (error) {
      if (error instanceof LabError) return Response.json({ code: error.code, message: error.message }, { status: error.status, headers: labHeaders });
      console.error("ASSIGNMENT_LAB_REQUEST_FAILED", { type: error instanceof Error ? error.name : "unknown" });
      return Response.json({ code: "LAB_FAILED", message: "The lab could not complete this request. Your saved versions are unchanged; please try again." }, { status: 500, headers: labHeaders });
    }
  };
}

