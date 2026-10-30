import { after } from "next/server";
import { saveGradingFailure, type GradingFailureInput } from "./gradingFailures";

export function gradingFailureCode(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.split(":")[0] : "";
  return ["OPENAI_TIMEOUT", "RUBRIC_STRUCTURE_FAILED", "RUBRIC_MODEL_UNAVAILABLE", "EVALUATION_FAILED", "FILE_PARSE_FAILED", "OCR_UNAVAILABLE", "UNSUPPORTED_FILE_TYPE", "TEXT_EXTRACTION_FAILED"].includes(message) ? message : fallback;
}

export function queueGradingFailure(input: GradingFailureInput): void {
  try {
    after(async () => {
      try {
        const id = await saveGradingFailure(input);
        console.info(id ? "GRADING_FAILURE_SAVED" : "GRADING_FAILURE_CAPTURE_LIMIT", { requestId: input.requestId, id });
      } catch {
        console.warn("GRADING_FAILURE_SAVE_FAILED", { requestId: input.requestId });
      }
    });
  } catch {
    console.warn("GRADING_FAILURE_SCHEDULE_FAILED", { requestId: input.requestId });
  }
}
