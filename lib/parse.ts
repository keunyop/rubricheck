import mammoth from "mammoth";

type PdfParseResult = {
  text?: string;
};

type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;

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

export async function parseFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new FileParseValidationError(`File is empty: ${file.name || "unnamed"}`);
  }

  const extension = getFileExtension(file.name);

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

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
