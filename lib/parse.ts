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
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    getFileExtension(file.name) === ".pdf"
  );
}

function isDocx(file: File): boolean {
  return (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    getFileExtension(file.name) === ".docx"
  );
}

export async function parseFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new FileParseValidationError(`File is empty: ${file.name || "unnamed"}`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (isPdf(file)) {
    try {
      const pdfParse = loadPdfParse();
      const result = await pdfParse(buffer);
      return normalizeText(result.text ?? "");
    } catch {
      throw new FileParseValidationError(`Invalid or unreadable PDF file: ${file.name}`);
    }
  }

  if (isDocx(file)) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return normalizeText(result.value ?? "");
    } catch {
      throw new FileParseValidationError(`Invalid or unreadable DOCX file: ${file.name}`);
    }
  }

  throw new FileParseValidationError(
    `Unsupported file type: ${file.type || "unknown"} (${file.name || "unnamed"})`,
  );
}
