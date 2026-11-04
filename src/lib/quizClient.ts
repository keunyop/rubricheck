export async function quizFetch<T>(path: string, body?: unknown, method = "POST", signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal, ...(body === undefined ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.code ?? "QUIZ_UNAVAILABLE");
  return data as T;
}

export const quizErrorMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    AUTH_REQUIRED: "Log in to create and save quizzes.",
    QUIZ_SOURCE_EXPIRED: "Source expired. Attach it again to create new questions.",
    TRIAL_EXPIRED: "Source expired. Attach it again to create new questions.",
    QUIZ_LIMIT_REACHED: "You have used your 10 free questions. Continue with Pro.",
    QUIZ_BUSY: "A task is already running. Open My quizzes to check it.",
    QUIZ_SOURCE_LIMIT: "Select up to 50 pages or slides, 50,000 characters and 50 MB in total.",
    QUIZ_SELECT_RANGE: "Choose up to 50 pages or slides before processing.",
    QUIZ_FILE_LIMIT: "Each file must be 20 MB or less.",
    QUIZ_FILE_TYPE: "Use PDF, DOCX, PPTX, TXT, PNG or JPG.",
    QUIZ_UNREADABLE_SOURCE: "Could not read this source. Replace it or paste readable text.",
    QUIZ_INVALID_RANGE: "Check the selected range. Use numbers such as 1-5, 8.",
    QUIZ_INVALID_SOURCES: "Choose up to 5 sources and one assignment version.",
    QUIZ_INSUFFICIENT_SOURCE: "Not enough supported content. Add material or change the range. No questions charged.",
    QUIZ_NO_IMPROVEMENTS: "Choose core concepts; no review guidance is available for this assignment.",
    QUIZ_NOT_FOUND: "This quiz or record is no longer available.",
    QUIZ_ATTEMPT_CONFLICT: "Progress changed in another tab. Reload the saved attempt.",
    QUIZ_ANSWER_LOCKED: "This answer is confirmed. Start a new attempt to answer again.",
    QUIZ_GENERATION_FAILED: "Could not generate questions. No questions charged. Try again.",
    QUIZ_INTERRUPTED: "Could not generate questions. No questions charged. Try again.",
    QUIZ_UPLOAD_INCOMPLETE: "Upload incomplete. Select the file and try again.",
  };
  return messages[code] ?? "Could not save or load your quiz. Try again.";
};
