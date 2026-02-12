import { NextResponse } from "next/server";

import { FileParseValidationError, parseFile } from "../../../lib/parse";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function getUploadedFile(
  formData: FormData,
  fieldName: "rubric" | "essay",
): File | null {
  const value = formData.get(fieldName);

  if (!(value instanceof File)) {
    return null;
  }

  return value;
}

function validateFileSize(file: File, fieldName: "rubric" | "essay"): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${fieldName} file size must be 5MB or less`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const rubricFile = getUploadedFile(formData, "rubric");
    const essayFile = getUploadedFile(formData, "essay");

    if (!rubricFile || !essayFile) {
      return NextResponse.json(
        { error: "Both rubric and essay files are required" },
        { status: 400 },
      );
    }

    const rubricSizeError = validateFileSize(rubricFile, "rubric");
    if (rubricSizeError) {
      return NextResponse.json({ error: rubricSizeError }, { status: 400 });
    }

    const essaySizeError = validateFileSize(essayFile, "essay");
    if (essaySizeError) {
      return NextResponse.json({ error: essaySizeError }, { status: 400 });
    }

    const [rubricText, essayText] = await Promise.all([
      parseFile(rubricFile),
      parseFile(essayFile),
    ]);

    return NextResponse.json({ rubricText, essayText });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process uploaded files";

    const status = error instanceof FileParseValidationError ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
