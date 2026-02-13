import { NextResponse } from "next/server";

import { FileParseValidationError, parseFile } from "../../../lib/parse";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function getUploadedFile(
  formData: FormData,
  fieldName: "rubric" | "assignment",
): File | null {
  const value = formData.get(fieldName);

  if (!(value instanceof File)) {
    return null;
  }

  return value;
}

function getTextInput(
  formData: FormData,
  fieldName: "rubricText" | "assignmentText",
): string | null {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return null;
  }

  if (value.trim().length === 0) {
    return null;
  }

  return value;
}

function validateFileSize(
  file: File,
  fieldName: "rubric" | "assignment",
): NextResponse | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", field: fieldName }, { status: 400 });
  }

  return null;
}

async function resolveFieldText(
  field: "rubric" | "assignment",
  textValue: string | null,
  file: File | null,
): Promise<string> {
  if (textValue !== null) {
    return textValue;
  }

  if (!file) {
    throw new Error("MISSING_INPUT");
  }

  try {
    return await parseFile(file);
  } catch (error) {
    if (error instanceof Error && error.message === "TEXT_EXTRACTION_FAILED") {
      throw new Error(`TEXT_EXTRACTION_FAILED:${field}`);
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_FILE_TYPE") {
      throw new Error(`UNSUPPORTED_FILE_TYPE:${field}`);
    }

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const rubricFile = getUploadedFile(formData, "rubric");
    const assignmentFile = getUploadedFile(formData, "assignment");
    const rubricTextInput = getTextInput(formData, "rubricText");
    const assignmentTextInput = getTextInput(formData, "assignmentText");

    if (rubricFile) {
      const rubricSizeError = validateFileSize(rubricFile, "rubric");
      if (rubricSizeError) {
        return rubricSizeError;
      }
    }

    if (assignmentFile) {
      const assignmentSizeError = validateFileSize(assignmentFile, "assignment");
      if (assignmentSizeError) {
        return assignmentSizeError;
      }
    }

    if (!rubricTextInput && !rubricFile) {
      return NextResponse.json({ error: "MISSING_INPUT" }, { status: 400 });
    }

    if (!assignmentTextInput && !assignmentFile) {
      return NextResponse.json({ error: "MISSING_INPUT" }, { status: 400 });
    }

    const rubricText = await resolveFieldText("rubric", rubricTextInput, rubricFile);
    const assignmentText = await resolveFieldText(
      "assignment",
      assignmentTextInput,
      assignmentFile,
    );

    return NextResponse.json({ rubricText, assignmentText });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_INPUT") {
      return NextResponse.json({ error: "MISSING_INPUT" }, { status: 400 });
    }

    if (error instanceof Error && error.message.startsWith("UNSUPPORTED_FILE_TYPE:")) {
      const field = error.message.split(":")[1] as "rubric" | "assignment";
      return NextResponse.json({ error: "UNSUPPORTED_FILE_TYPE", field }, { status: 400 });
    }

    if (error instanceof Error && error.message.startsWith("TEXT_EXTRACTION_FAILED:")) {
      const field = error.message.split(":")[1] as "rubric" | "assignment";
      return NextResponse.json({ error: "TEXT_EXTRACTION_FAILED", field }, { status: 400 });
    }

    if (error instanceof FileParseValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to process uploaded files" }, { status: 500 });
  }
}
