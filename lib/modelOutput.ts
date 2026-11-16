// Keep provider diagnostics bounded: never retain output text, refusal text,
// provider errors, prompts, response IDs, or arbitrary metadata in the error.
type ResponseStatus = "completed" | "incomplete" | "failed" | "cancelled" | "queued" | "in_progress" | "unknown";
type IncompleteReason = "max_output_tokens" | "content_filter" | "none" | "other";
type OutputFailureReason = "invalid_json" | "incomplete" | "refusal" | "empty_output" | "response_failed";

export type ModelOutputDiagnostics = {
  reason: OutputFailureReason;
  responseStatus: ResponseStatus;
  incompleteReason: IncompleteReason;
  hasText: boolean;
  hasRefusal: boolean;
};

export class ModelOutputError extends Error {
  readonly diagnostics: Readonly<ModelOutputDiagnostics>;

  constructor(diagnostics: ModelOutputDiagnostics) {
    // Preserve the existing caller contract and bounded retry behavior.
    super("MODEL_JSON_PARSE_FAILED");
    this.diagnostics = Object.freeze({ ...diagnostics });
  }
}
