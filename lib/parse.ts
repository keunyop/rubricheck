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

export async function parseFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new FileParseValidationError(`File is empty: ${file.name || "unnamed"}`);
  }

  const extension = getFileExtension(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (extension === ".pdf") {
    try {
      const pdfParse = loadPdfParse();
      const result = await pdfParse(buffer);
      return normalizeText(result.text ?? "");
    } catch {
      throw new FileParseValidationError(`Invalid or unreadable PDF file: ${file.name}`);
    }
  }

  if (extension === ".docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return normalizeText(result.value ?? "");
    } catch {
      throw new FileParseValidationError(`Invalid or unreadable DOCX file: ${file.name}`);
    }
  }

  if (extension === ".txt") {
    return normalizeText(buffer.toString("utf-8"));
  }

  throw new Error(`Unsupported file type: ${file.type || "unknown"} (${file.name})`);
}
