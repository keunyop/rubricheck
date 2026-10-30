import mammoth from "mammoth";

type PdfParseResult = {
  text?: string;
};

type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;
type ParsedField = "rubric" | "assignment";
type VisionFeatureType = "DOCUMENT_TEXT_DETECTION" | "TEXT_DETECTION";

type VisionOcrClient = {
  extractText: (params: { imageContentBase64: string; field: ParsedField }) => Promise<string>;
};

type ParseFileOptions = {
  field?: ParsedField;
  visionOcrClient?: VisionOcrClient;
  requireMeaningfulText?: boolean;
};

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const DEFAULT_OCR_LANGUAGE_HINTS = ["en", "ko"];
const GOOGLE_VISION_ANNOTATE_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const GOOGLE_VISION_TIMEOUT_MS = 20_000;
const SAFE_VISION_ERROR_REASONS = new Set([
  "API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED",
  "API_KEY_HTTP_REFERRER_BLOCKED", "SERVICE_DISABLED", "BILLING_DISABLED", "RATE_LIMIT_EXCEEDED", "QUOTA_EXCEEDED",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeVisionReason(error: Record<string, unknown> | null): string | undefined {
  if (!Array.isArray(error?.details)) return undefined;
  for (const detail of error.details) {
    const reason = asRecord(detail)?.reason;
    if (typeof reason === "string" && SAFE_VISION_ERROR_REASONS.has(reason)) return reason;
  }
  return undefined;
}

function visionUnavailable(field: ParsedField, reason: "missing_api_key" | "network_error" | "timeout" | "provider_error" | "invalid_response", details: { httpStatus?: number; rpcCode?: number; providerReason?: string } = {}): never {
  // Provider messages, URLs and bodies can contain credentials or student content.
  console.error("GOOGLE_VISION_OCR_FAILED", { field, reason, ...details });
  throw new Error("GOOGLE_VISION_OCR_UNAVAILABLE");
}

function loadPdfParse(): PdfParseFunction {
  // Avoid the package root entry because it executes debug-only file I/O in Next dev.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("pdf-parse/lib/pdf-parse.js") as PdfParseFunction;
}

export class FileParseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileParseValidationError";
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function parseOcrLanguageHints(raw: string | undefined): string[] {
  if (!raw) {
    return DEFAULT_OCR_LANGUAGE_HINTS;
  }

  const parsed = raw
    .split(",")
    .map((hint) => hint.trim())
    .filter((hint) => hint.length > 0);

  return parsed.length > 0 ? parsed : DEFAULT_OCR_LANGUAGE_HINTS;
}

function resolveVisionFeature(field: ParsedField): VisionFeatureType {
  return field === "rubric" ? "DOCUMENT_TEXT_DETECTION" : "TEXT_DETECTION";
}

function createGoogleVisionOcrClient(): VisionOcrClient {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim();

  const languageHints = parseOcrLanguageHints(process.env.GOOGLE_VISION_LANGUAGE_HINTS);

  return {
    async extractText({ imageContentBase64, field }) {
      if (!apiKey) visionUnavailable(field, "missing_api_key");
      const requestBody = {
        requests: [
          {
            image: { content: imageContentBase64 },
            features: [{ type: resolveVisionFeature(field) }],
            imageContext: { languageHints },
          },
        ],
      };

      let response: Response;
      let payload: Record<string, unknown> | null;
      const signal = AbortSignal.timeout(GOOGLE_VISION_TIMEOUT_MS);
      try {
        response = await fetch(GOOGLE_VISION_ANNOTATE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
          body: JSON.stringify(requestBody),
          signal,
        });
        // Read the body within the same deadline. Invalid bodies are service failures.
        payload = asRecord(await response.json().catch((error: unknown) => {
          if (signal.aborted) throw error;
          return null;
        }));
      } catch {
        visionUnavailable(field, signal.aborted ? "timeout" : "network_error");
      }

      if (!response.ok) {
        const providerReason = safeVisionReason(asRecord(payload?.error));
        visionUnavailable(field, "provider_error", { httpStatus: response.status, ...(providerReason ? { providerReason } : {}) });
      }

      const result = Array.isArray(payload?.responses) ? asRecord(payload.responses[0]) : null;
      if (!result) visionUnavailable(field, "invalid_response", { httpStatus: response.status });

      if (result.error) {
        const error = asRecord(result.error);
        // Per-image errors use google.rpc.Code, not HTTP status codes.
        if (error?.code === 3) {
          throw new Error("TEXT_EXTRACTION_FAILED");
        }
        visionUnavailable(field, "provider_error", { httpStatus: response.status, ...(typeof error?.code === "number" ? { rpcCode: error.code } : {}) });
      }

      const rawText = asRecord(result.fullTextAnnotation)?.text
        ?? (Array.isArray(result.textAnnotations) ? asRecord(result.textAnnotations[0])?.description : undefined) ?? "";
      if (typeof rawText !== "string") visionUnavailable(field, "invalid_response", { httpStatus: response.status });
      if (!rawText.trim()) {
        throw new Error("TEXT_EXTRACTION_FAILED");
      }

      return rawText;
    },
  };
}

export function ensureMeaningfulText(text: string, fileName: string): string {
  void fileName;
  const trimmedText = text.trim();

  if (trimmedText.length < 200) {
    throw new Error("TEXT_EXTRACTION_FAILED");
  }

  const alphanumericMatches = trimmedText.match(/[\p{L}\p{N}]/gu) ?? [];
  const alphanumericRatio = alphanumericMatches.length / trimmedText.length;

  if (alphanumericRatio < 0.05) {
    throw new Error("TEXT_EXTRACTION_FAILED");
  }

  return text;
}

export function cleanupOcrText(text: string, field: ParsedField): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\u00a0/g, " ");

  if (field === "rubric") {
    return normalized
      .split("\n")
      .map((line) => line.replace(/^[ \t]*[\-*][ \t]*/, "- ").replace(/[ \t]{2,}/g, " ").trim())
      .join("\n");
  }

  return normalized
    .replace(/-\n(?=[\p{L}\p{N}])/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parseImageWithOcr(
  file: File,
  field: ParsedField,
  visionOcrClient: VisionOcrClient | undefined,
  requireMeaningfulText: boolean,
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const imageContentBase64 = Buffer.from(arrayBuffer).toString("base64");
  const ocrClient = visionOcrClient ?? createGoogleVisionOcrClient();
  const ocrText = await ocrClient.extractText({ imageContentBase64, field });
  const cleaned = cleanupOcrText(ocrText, field);
  const normalized = normalizeText(cleaned);
  return requireMeaningfulText ? ensureMeaningfulText(normalized, file.name) : normalized;
}

export async function parseFile(file: File, options: ParseFileOptions = {}): Promise<string> {
  if (file.size === 0) {
    throw new FileParseValidationError(`File is empty: ${file.name || "unnamed"}`);
  }

  const extension = getFileExtension(file.name);
  const field = options.field ?? "assignment";
  const requireMeaningfulText = options.requireMeaningfulText ?? true;

  if (extension === ".pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const pdfParse = loadPdfParse();
      const result = await pdfParse(buffer);
      const normalizedText = normalizeText(result.text ?? "");
      return requireMeaningfulText ? ensureMeaningfulText(normalizedText, file.name) : normalizedText;
    } catch (error) {
      if (error instanceof Error && error.message === "TEXT_EXTRACTION_FAILED") {
        throw error;
      }
      throw new FileParseValidationError(`Invalid or unreadable PDF file: ${file.name}`);
    }
  }

  if (extension === ".docx") {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const result = await mammoth.extractRawText({ buffer });
      const normalizedText = normalizeText(result.value ?? "");
      return requireMeaningfulText ? ensureMeaningfulText(normalizedText, file.name) : normalizedText;
    } catch (error) {
      if (error instanceof Error && error.message === "TEXT_EXTRACTION_FAILED") {
        throw error;
      }
      throw new FileParseValidationError(`Invalid or unreadable DOCX file: ${file.name}`);
    }
  }

  if (extension === ".txt") {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return normalizeText(buffer.toString("utf-8"));
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return parseImageWithOcr(file, field, options.visionOcrClient, requireMeaningfulText);
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
