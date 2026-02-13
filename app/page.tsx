"use client";

import { FormEvent, useMemo, useState } from "react";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES_LABEL = ".pdf, .docx, .txt";

type LoadingStep = "idle" | "uploading" | "parsing";

export default function Home() {
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [rubricText, setRubricText] = useState("");
  const [assignmentText, setAssignmentText] = useState("");
  const [showRubricText, setShowRubricText] = useState(false);
  const [showAssignmentText, setShowAssignmentText] = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [error, setError] = useState<string>("");

  const isLoading = loadingStep !== "idle";

  const loadingMessage = useMemo(() => {
    if (loadingStep === "uploading") {
      return "Uploading...";
    }

    if (loadingStep === "parsing") {
      return "Parsing files...";
    }

    return "";
  }, [loadingStep]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const hasRubricText = rubricText.trim().length > 0;
    const hasAssignmentText = assignmentText.trim().length > 0;

    if (!hasRubricText && !rubricFile) {
      setError("Please provide a rubric file or paste rubric text.");
      return;
    }

    if (!hasAssignmentText && !assignmentFile) {
      setError("Please provide an assignment file or paste assignment text.");
      return;
    }

    if (rubricFile && rubricFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Rubric file must be 5MB or smaller.");
      return;
    }

    if (assignmentFile && assignmentFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Assignment file must be 5MB or smaller.");
      return;
    }

    try {
      setLoadingStep("uploading");

      const formData = new FormData();
      // Pasted text takes precedence over files for each field.
      if (!hasRubricText && rubricFile) {
        formData.append("rubric", rubricFile);
      }
      if (!hasAssignmentText && assignmentFile) {
        formData.append("assignment", assignmentFile);
      }
      if (hasRubricText) {
        formData.append("rubricText", rubricText);
      }
      if (hasAssignmentText) {
        formData.append("assignmentText", assignmentText);
      }

      const requestPromise = fetch("/api/grade", {
        method: "POST",
        body: formData,
      });
      setLoadingStep("parsing");
      const response = await requestPromise;

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to process files.";

        if (message === "TEXT_EXTRACTION_FAILED") {
          const field = data?.field;
          if (field === "rubric") {
            setError(
              "Text extraction failed for Rubric. Please upload a text-based PDF/DOCX or paste the text.",
            );
            return;
          }
          if (field === "assignment" || field === "essay") {
            setError(
              "Text extraction failed for Assignment. Please upload a text-based PDF/DOCX or paste the text.",
            );
            return;
          }
          setError(
            "Text extraction failed. Please upload a text-based PDF/DOCX or paste the text.",
          );
          return;
        }

        if (message === "UNSUPPORTED_FILE_TYPE") {
          setError(`Unsupported file type. Allowed types: ${ALLOWED_TYPES_LABEL}`);
          return;
        }

        setError(message);
        return;
      }

      console.log("/api/grade response:", data);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Request failed.";
      setError(message);
    } finally {
      setLoadingStep("idle");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              RubriCheck Upload
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Upload files or paste text. Pasted text takes precedence per field.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="rubric"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Rubric file
              </label>
              <input
                id="rubric"
                name="rubric"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(event) => setRubricFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowRubricText((current) => !current)}
                className="mt-2 text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                Paste text instead
              </button>
            </div>

            {showRubricText ? (
              <div>
                <label
                  htmlFor="rubricText"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Rubric text
                </label>
                <textarea
                  id="rubricText"
                  name="rubricText"
                  rows={6}
                  value={rubricText}
                  onChange={(event) => setRubricText(event.target.value)}
                  placeholder="Paste rubric text here"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            ) : null}

            <div>
              <label
                htmlFor="assignment"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Assignment file
              </label>
              <input
                id="assignment"
                name="assignment"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(event) => setAssignmentFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowAssignmentText((current) => !current)}
                className="mt-2 text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                Paste text instead
              </button>
            </div>

            {showAssignmentText ? (
              <div>
                <label
                  htmlFor="assignmentText"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Assignment text
                </label>
                <textarea
                  id="assignmentText"
                  name="assignmentText"
                  rows={10}
                  value={assignmentText}
                  onChange={(event) => setAssignmentText(event.target.value)}
                  placeholder="Paste assignment text here"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {isLoading ? <p className="text-sm text-slate-600">{loadingMessage}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Submit
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
