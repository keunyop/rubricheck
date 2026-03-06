import mammoth from "mammoth";

type PdfParseResult = {
  text?: string;
};

type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;
type ParsedField = "rubric" | "assignment";
type VisionFeatureType = "DOCUMENT_TEXT_DETECTION" | "TEXT_DETECTION";

type VisionApiResponse = {
  responses?: Array<{
    fullTextAnnotation?: {
      text?: string;
    };
    textAnnotations?: Array<{
      description?: string;
    }>;
    error?: {
      code?: number;
      message?: string;
    };
  }>;
};

type VisionOcrClient = {
  extractText: (params: { imageContentBase64: string; field: ParsedField }) => Promise<string>;
};

type ParseFileOptions = {
  field?: ParsedField;
  visionOcrClient?: VisionOcrClient;
};

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const DEFAULT_OCR_LANGUAGE_HINTS = ["en", "ko"];
const GOOGLE_VISION_ANNOTATE_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

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
  if (!apiKey) {
    throw new Error("GOOGLE_VISION_OCR_UNAVAILABLE");
  }

  const languageHints = parseOcrLanguageHints(process.env.GOOGLE_VISION_LANGUAGE_HINTS);

  return {
    async extractText({ imageContentBase64, field }) {
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
      try {
        response = await fetch(`${GOOGLE_VISION_ANNOTATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch {
        throw new Error("GOOGLE_VISION_OCR_UNAVAILABLE");
      }

      if (!response.ok) {
        throw new Error("GOOGLE_VISION_OCR_UNAVAILABLE");
      }

      const payload = (await response.json()) as VisionApiResponse;
      const result = payload.responses?.[0];

      if (result?.error) {
        if (typeof result.error.code === "number" && result.error.code >= 400 && result.error.code < 500) {
          throw new Error("TEXT_EXTRACTION_FAILED");
        }
        throw new Error("GOOGLE_VISION_OCR_UNAVAILABLE");
      }

      const rawText = result?.fullTextAnnotation?.text ?? result?.textAnnotations?.[0]?.description ?? "";
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

async function parseImageWithOcr(file: File, field: ParsedField, visionOcrClient?: VisionOcrClient): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const imageContentBase64 = Buffer.from(arrayBuffer).toString("base64");
  const ocrClient = visionOcrClient ?? createGoogleVisionOcrClient();
  const ocrText = await ocrClient.extractText({ imageContentBase64, field });
  const cleaned = cleanupOcrText(ocrText, field);
  return ensureMeaningfulText(normalizeText(cleaned), file.name);
}

export async function parseFile(file: File, options: ParseFileOptions = {}): Promise<string> {
  if (file.size === 0) {
    throw new FileParseValidationError(`File is empty: ${file.name || "unnamed"}`);
  }

  const extension = getFileExtension(file.name);
  const field = options.field ?? "assignment";

  if (extension === ".pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const pdfParse = loadPdfParse();
      const result = await pdfParse(buffer);
      const normalizedText = normalizeText(result.text ?? "");
      return ensureMeaningfulText(normalizedText, file.name);
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
      return ensureMeaningfulText(normalizedText, file.name);
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
    return parseImageWithOcr(file, field, options.visionOcrClient);
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
