"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type InputMode = "upload" | "paste";
type LoadingStep =
  | "idle"
  | "uploading"
  | "parsing"
  | "structuringRubric"
  | "evaluatingAssignment";

type GradeErrorResponse = {
  error?: string;
  field?: "rubric" | "assignment";
};

type CriteriaScore = {
  name: string;
  estimated_range: [number, number];
  feedback: string;
};

type GradeResult = {
  overall_range: [number, number];
  summary: string;
  criteria_scores: CriteriaScore[];
  top_improvements: string[];
};

const loadingStepLabels: Record<Exclude<LoadingStep, "idle">, string> = {
  uploading: "Uploading...",
  parsing: "Parsing files...",
  structuringRubric: "Structuring rubric...",
  evaluatingAssignment: "Evaluating assignment...",
};

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const rubricInputRef = useRef<HTMLInputElement | null>(null);
  const assignmentInputRef = useRef<HTMLInputElement | null>(null);

  const [rubricMode, setRubricMode] = useState<InputMode>("upload");
  const [assignmentMode, setAssignmentMode] = useState<InputMode>("upload");

  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [rubricText, setRubricText] = useState("");
  const [assignmentText, setAssignmentText] = useState("");

  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);

  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [error, setError] = useState("");

  const isLoading = loadingStep !== "idle";

  const loadingMessage = useMemo(() => {
    if (loadingStep === "idle") {
      return "";
    }

    return loadingStepLabels[loadingStep];
  }, [loadingStep]);

  function switchRubricMode(nextMode: InputMode) {
    setRubricMode(nextMode);

    if (nextMode === "paste") {
      setRubricFile(null);
      if (rubricInputRef.current) {
        rubricInputRef.current.value = "";
      }
      return;
    }

    setRubricText("");
  }

  function switchAssignmentMode(nextMode: InputMode) {
    setAssignmentMode(nextMode);

    if (nextMode === "paste") {
      setAssignmentFile(null);
      if (assignmentInputRef.current) {
        assignmentInputRef.current.value = "";
      }
      return;
    }

    setAssignmentText("");
  }

  function mapApiError(data: GradeErrorResponse): string {
    const message = data.error;

    if (message === "MISSING_INPUT") {
      return "Please provide both a rubric and an assignment.";
    }

    if (message === "TEXT_EXTRACTION_FAILED") {
      const target = data.field === "rubric" ? "Rubric" : "Assignment";
      return `Text extraction failed for ${target}. Please upload a text-based PDF/DOCX or paste the text.`;
    }

    if (message === "UNSUPPORTED_FILE_TYPE") {
      return "Unsupported file type. Please upload PDF, DOCX, or TXT.";
    }

    if (message === "RUBRIC_STRUCTURE_FAILED") {
      return "Failed to structure the rubric. Please revise the rubric and try again.";
    }

    if (message === "EVALUATION_FAILED") {
      return "Failed to evaluate the assignment. Please try again.";
    }

    return "Something went wrong. Please try again.";
  }

  function isGradeResult(value: unknown): value is GradeResult {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<GradeResult>;

    const hasOverallRange =
      Array.isArray(candidate.overall_range) &&
      candidate.overall_range.length === 2 &&
      candidate.overall_range.every((item) => typeof item === "number");

    const hasSummary = typeof candidate.summary === "string";

    const hasCriteriaScores =
      Array.isArray(candidate.criteria_scores) &&
      candidate.criteria_scores.every((item) => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const row = item as Partial<CriteriaScore>;
        return (
          typeof row.name === "string" &&
          Array.isArray(row.estimated_range) &&
          row.estimated_range.length === 2 &&
          row.estimated_range.every((rangeItem) => typeof rangeItem === "number") &&
          typeof row.feedback === "string"
        );
      });

    const hasTopImprovements =
      Array.isArray(candidate.top_improvements) &&
      candidate.top_improvements.length >= 3 &&
      candidate.top_improvements.length <= 5 &&
      candidate.top_improvements.every((item) => typeof item === "string");

    return hasOverallRange && hasSummary && hasCriteriaScores && hasTopImprovements;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setGradeResult(null);
    const stepTimers: Array<ReturnType<typeof setTimeout>> = [];

    const hasRubricText = rubricText.trim().length > 0;
    const hasAssignmentText = assignmentText.trim().length > 0;

    const rubricReady =
      rubricMode === "upload" ? rubricFile !== null : hasRubricText;
    const assignmentReady =
      assignmentMode === "upload" ? assignmentFile !== null : hasAssignmentText;

    if (!rubricReady || !assignmentReady) {
      setError("Please provide both a rubric and an assignment.");
      return;
    }

    if (rubricMode === "upload" && rubricFile && rubricFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Something went wrong. Please try again.");
      return;
    }

    if (
      assignmentMode === "upload" &&
      assignmentFile &&
      assignmentFile.size > MAX_FILE_SIZE_BYTES
    ) {
      setError("Something went wrong. Please try again.");
      return;
    }

    try {
      setLoadingStep("uploading");

      const formData = new FormData();

      if (rubricMode === "upload" && rubricFile) {
        formData.append("rubric", rubricFile);
      } else {
        formData.append("rubricText", rubricText.trim());
      }

      if (assignmentMode === "upload" && assignmentFile) {
        formData.append("assignment", assignmentFile);
      } else {
        formData.append("assignmentText", assignmentText.trim());
      }

      const requestPromise = fetch("/api/grade", {
        method: "POST",
        body: formData,
      });

      stepTimers.push(
        setTimeout(() => setLoadingStep("parsing"), 150),
        setTimeout(() => setLoadingStep("structuringRubric"), 600),
        setTimeout(() => setLoadingStep("evaluatingAssignment"), 1200),
      );

      const response = await requestPromise;
      for (const timer of stepTimers) {
        clearTimeout(timer);
      }
      setLoadingStep("evaluatingAssignment");

      const contentType = response.headers.get("content-type") ?? "";
      const data: unknown = contentType.includes("application/json")
        ? await response.json()
        : { error: "INTERNAL_SERVER_ERROR" };

      if (!response.ok) {
        setError(mapApiError((data ?? {}) as GradeErrorResponse));
        return;
      }

      if (!isGradeResult(data)) {
        setError("Something went wrong. Please try again.");
        return;
      }

      setGradeResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      for (const timer of stepTimers) {
        clearTimeout(timer);
      }
      setLoadingStep("idle");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">RubriCheck</h1>
            <p className="mt-2 text-sm text-slate-600">
              Upload files or paste text for your rubric and assignment.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-800">Rubric</label>
                <div className="inline-flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
                  <TabButton
                    active={rubricMode === "upload"}
                    onClick={() => switchRubricMode("upload")}
                  >
                    Upload file
                  </TabButton>
                  <TabButton
                    active={rubricMode === "paste"}
                    onClick={() => switchRubricMode("paste")}
                  >
                    Paste text
                  </TabButton>
                </div>
              </div>

              {rubricMode === "upload" ? (
                <input
                  ref={rubricInputRef}
                  id="rubric"
                  name="rubric"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(event) => setRubricFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                />
              ) : (
                <textarea
                  id="rubricText"
                  name="rubricText"
                  rows={6}
                  value={rubricText}
                  onChange={(event) => setRubricText(event.target.value)}
                  placeholder="Paste rubric text here"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-800">Assignment</label>
                <div className="inline-flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
                  <TabButton
                    active={assignmentMode === "upload"}
                    onClick={() => switchAssignmentMode("upload")}
                  >
                    Upload file
                  </TabButton>
                  <TabButton
                    active={assignmentMode === "paste"}
                    onClick={() => switchAssignmentMode("paste")}
                  >
                    Paste text
                  </TabButton>
                </div>
              </div>

              {assignmentMode === "upload" ? (
                <input
                  ref={assignmentInputRef}
                  id="assignment"
                  name="assignment"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(event) => setAssignmentFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                />
              ) : (
                <textarea
                  id="assignmentText"
                  name="assignmentText"
                  rows={8}
                  value={assignmentText}
                  onChange={(event) => setAssignmentText(event.target.value)}
                  placeholder="Paste assignment text here"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              )}
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

        {gradeResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Report Card</h2>

            <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
              Estimated Score Range: {gradeResult.overall_range[0]}-{gradeResult.overall_range[1]}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-700">{gradeResult.summary}</p>

            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Criterion</th>
                    <th className="px-4 py-3 font-semibold">Estimated Range</th>
                    <th className="px-4 py-3 font-semibold">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                  {gradeResult.criteria_scores.map((item) => (
                    <tr key={item.name}>
                      <td className="px-4 py-3 align-top font-medium">{item.name}</td>
                      <td className="px-4 py-3 align-top">
                        {item.estimated_range[0]}-{item.estimated_range[1]}
                      </td>
                      <td className="px-4 py-3 align-top">{item.feedback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">Top Improvements</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {gradeResult.top_improvements.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
