import { parseFile, FileParseValidationError } from "../../../../../lib/parse";
import { labHeaders, labRoute } from "../../../../../src/lib/assignmentLab/http";
import { LabError } from "../../../../../src/lib/assignmentLab/access";

export const runtime = "nodejs";
export const POST = labRoute(async (request) => {
  const maxBytes = 4 * 1024 * 1024;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new LabError(413, "FILE_TOO_LARGE", "Upload one PDF, DOCX or TXT file under 3 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new LabError(400, "MISSING_FILE", "Select a file.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new LabError(413, "FILE_TOO_LARGE", "Upload one PDF, DOCX or TXT file under 3 MB."); }
    chunks.push(value);
  }
  let form: FormData;
  try { form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") ?? "" }, body: Buffer.concat(chunks) }).formData(); }
  catch { throw new LabError(400, "INVALID_UPLOAD", "Upload one PDF, DOCX or TXT file."); }
  const files = form.getAll("file");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File) || !/\.(pdf|docx|txt)$/i.test(file.name)) throw new LabError(400, "INVALID_FILE", "Upload one PDF, DOCX or TXT file.");
  if (file.size === 0 || file.size > 3 * 1024 * 1024) throw new LabError(413, "FILE_TOO_LARGE", "The file must be non-empty and under 3 MB.");
  try {
    const text = (await parseFile(file)).trim();
    if (!text || text.length > 60000) throw new LabError(400, "INVALID_TEXT", "The file must contain 1–60,000 characters of readable text.");
    return Response.json({ text }, { headers: labHeaders });
  } catch (error) {
    if (error instanceof LabError) throw error;
    if (error instanceof FileParseValidationError) throw new LabError(400, "INVALID_FILE", "The file could not be read. Try a text-based PDF, DOCX or TXT file.");
    throw new LabError(400, "PARSE_FAILED", "The file could not be read. Paste its text instead.");
  }
});


