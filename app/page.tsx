"use client";

import { FormEvent, useMemo, useState } from "react";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type LoadingStep = "idle" | "uploading" | "parsing";

export default function Home() {
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [essayFile, setEssayFile] = useState<File | null>(null);
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

    if (!rubricFile || !essayFile) {
      setError("Please upload both rubric and essay files.");
      return;
    }

    if (rubricFile.size > MAX_FILE_SIZE_BYTES || essayFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Each file must be smaller than 5MB.");
      return;
    }

    try {
      setLoadingStep("uploading");

      const formData = new FormData();
      formData.append("rubric", rubricFile);
      formData.append("essay", essayFile);

      const response = await fetch("/api/grade", {
        method: "POST",
        body: formData,
      });

      setLoadingStep("parsing");

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };
      console.log("/api/grade response:", data);

      if (!response.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to process files.";
        setError(message);
      }
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
              Upload your rubric and essay files to begin grading.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="rubric"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Rubric File
              </label>
              <input
                id="rubric"
                name="rubric"
                type="file"
                onChange={(event) => setRubricFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="essay"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Essay File
              </label>
              <input
                id="essay"
                name="essay"
                type="file"
                onChange={(event) => setEssayFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </div>

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
