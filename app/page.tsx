"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

type InputMode = "file" | "text";
type InputField = "rubric" | "assignment";
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

type CriteriaResult = {
  name: string;
  max_score: number;
  estimated_range: [number, number];
  feedback: string;
};

type GradeResult = {
  title: string;
  overall_range: [number, number];
  summary: string;
  top_improvements: string[];
  criteria: CriteriaResult[];
};

const loadingStepLabels: Record<Exclude<LoadingStep, "idle">, string> = {
  uploading: "Uploading...",
  parsing: "Parsing files...",
  structuringRubric: "Structuring rubric...",
  evaluatingAssignment: "Evaluating assignment...",
};

function formatOverallScoreDisplay(range: [number, number]): string {
  const [low, high] = range;
  if (high - low <= 5) {
    return String(Math.round((low + high) / 2));
  }

  return `${low} – ${high}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(2)} MB`;
}

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function validateFile(file: File): string | null {
  const extension = getFileExtension(file.name);

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Unsupported file type. Please upload PDF, DOCX, or TXT.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File is too large. Max size is 5MB.";
  }

  return null;
}

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
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? "bg-slate-600 text-white shadow-sm"
          : "bg-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const rubricInputRef = useRef<HTMLInputElement | null>(null);
  const assignmentInputRef = useRef<HTMLInputElement | null>(null);
  const evaluationHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const [rubricMode, setRubricMode] = useState<InputMode>("file");
  const [assignmentMode, setAssignmentMode] = useState<InputMode>("file");

  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [rubricText, setRubricText] = useState("");
  const [assignmentText, setAssignmentText] = useState("");

  const [rubricDragOver, setRubricDragOver] = useState(false);
  const [assignmentDragOver, setAssignmentDragOver] = useState(false);

  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState("");

  const isLoading = loadingStep !== "idle";

  const loadingMessage = useMemo(() => {
    if (loadingStep === "idle") {
      return "";
    }

    return loadingStepLabels[loadingStep];
  }, [loadingStep]);

  useEffect(() => {
    if (!gradeResult || !evaluationHeadingRef.current) {
      return;
    }

    evaluationHeadingRef.current.focus();
    evaluationHeadingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    window.getSelection()?.removeAllRanges();
  }, [gradeResult]);

  function clearFile(field: InputField, inputRef?: RefObject<HTMLInputElement | null>) {
    if (field === "rubric") {
      setRubricFile(null);
    } else {
      setAssignmentFile(null);
    }

    const targetRef = inputRef ?? (field === "rubric" ? rubricInputRef : assignmentInputRef);
    if (targetRef.current) {
      targetRef.current.value = "";
    }
  }

  function switchRubricMode(nextMode: InputMode) {
    setRubricMode(nextMode);
    setError("");

    if (nextMode === "text") {
      clearFile("rubric");
      return;
    }

    setRubricText("");
  }

  function switchAssignmentMode(nextMode: InputMode) {
    setAssignmentMode(nextMode);
    setError("");

    if (nextMode === "text") {
      clearFile("assignment");
      return;
    }

    setAssignmentText("");
  }

  function applyFileSelection(field: InputField, file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      clearFile(field);
      return;
    }

    setError("");
    if (field === "rubric") {
      setRubricFile(file);
    } else {
      setAssignmentFile(file);
    }
  }

  function handleFileInputChange(field: InputField, event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    applyFileSelection(field, selectedFile);
  }

  function handleDrop(
    field: InputField,
    event: DragEvent<HTMLDivElement>,
    setDragOver: (value: boolean) => void,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) {
      return;
    }

    if (files.length > 1) {
      setError("Please drop only one file.");
      return;
    }

    applyFileSelection(field, files[0]);
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

    if (message === "FILE_TOO_LARGE") {
      return "File is too large. Max size is 5MB.";
    }

    return "Something went wrong. Please try again.";
  }

  function isGradeResult(value: unknown): value is GradeResult {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<GradeResult>;

    const hasTitle = typeof candidate.title === "string";
    const hasSummary = typeof candidate.summary === "string";
    const hasOverallRange =
      Array.isArray(candidate.overall_range) &&
      candidate.overall_range.length === 2 &&
      candidate.overall_range.every((item) => typeof item === "number");
    const hasTopImprovements =
      Array.isArray(candidate.top_improvements) &&
      candidate.top_improvements.length === 3 &&
      candidate.top_improvements.every((item) => typeof item === "string");
    const hasCriteria =
      Array.isArray(candidate.criteria) &&
      candidate.criteria.every((item) => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const row = item as Partial<CriteriaResult>;
        return (
          typeof row.name === "string" &&
          typeof row.max_score === "number" &&
          Array.isArray(row.estimated_range) &&
          row.estimated_range.length === 2 &&
          row.estimated_range.every((value) => typeof value === "number") &&
          typeof row.feedback === "string"
        );
      });

    return hasTitle && hasSummary && hasOverallRange && hasTopImprovements && hasCriteria;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setGradeResult(null);

    const stepTimers: Array<ReturnType<typeof setTimeout>> = [];

    const rubricProvided = rubricMode === "file" ? rubricFile !== null : rubricText.trim().length > 0;
    const assignmentProvided =
      assignmentMode === "file" ? assignmentFile !== null : assignmentText.trim().length > 0;

    if (!rubricProvided || !assignmentProvided) {
      setError("Please provide both a rubric and an assignment.");
      return;
    }

    if (rubricMode === "file" && rubricFile && rubricFile.size > MAX_FILE_SIZE_BYTES) {
      setError("File is too large. Max size is 5MB.");
      return;
    }

    if (assignmentMode === "file" && assignmentFile && assignmentFile.size > MAX_FILE_SIZE_BYTES) {
      setError("File is too large. Max size is 5MB.");
      return;
    }

    try {
      setLoadingStep("uploading");

      const formData = new FormData();

      if (rubricMode === "file") {
        if (!rubricFile) {
          setError("Please provide both a rubric and an assignment.");
          return;
        }
        formData.append("rubric", rubricFile);
      } else {
        formData.append("rubricText", rubricText.trim());
      }

      if (assignmentMode === "file") {
        if (!assignmentFile) {
          setError("Please provide both a rubric and an assignment.");
          return;
        }
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
        setTimeout(() => setLoadingStep("structuringRubric"), 650),
        setTimeout(() => setLoadingStep("evaluatingAssignment"), 1250),
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
    <main className="min-h-screen bg-slate-300 px-4 py-10 md:py-14">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">RubriCheck</h1>
            <p className="mt-2 text-sm text-slate-600 md:text-[15px]">
              Upload your rubric and assignment to get a rubric-based score estimate in seconds.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section
                className={`rounded-2xl border bg-slate-100/80 p-4 transition md:p-5 ${
                  rubricMode === "file" && rubricDragOver
                    ? "-translate-y-px border-indigo-200 shadow-md ring-2 ring-indigo-100"
                    : "border-slate-200 shadow-sm"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4 text-indigo-600/70"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 3v5h5M9 13h6M9 17h6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <h2 className="text-base font-semibold text-slate-900">Rubric</h2>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-1">
                    <TabButton active={rubricMode === "file"} onClick={() => switchRubricMode("file")}>
                      File
                    </TabButton>
                    <TabButton active={rubricMode === "text"} onClick={() => switchRubricMode("text")}>
                      Text
                    </TabButton>
                  </div>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  Scoring rubric used to evaluate the assignment.
                </p>

                {rubricMode === "file" ? (
                  <div className="space-y-3">
                    <input
                      ref={rubricInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(event) => handleFileInputChange("rubric", event)}
                    />
                    <div
                      onDragEnter={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRubricDragOver(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRubricDragOver(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRubricDragOver(false);
                      }}
                      onDrop={(event) => handleDrop("rubric", event, setRubricDragOver)}
                      className={`rounded-xl border-2 border-dashed bg-white p-5 text-center transition ${
                        rubricDragOver
                          ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-100"
                          : "border-slate-300 hover:border-indigo-300"
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-700">Drag and drop a file here</p>
                      <p className="mt-1 text-xs text-slate-500">PDF, DOCX, or TXT up to 5MB</p>
                      <button
                        type="button"
                        onClick={() => rubricInputRef.current?.click()}
                        className="mt-4 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        Choose File
                      </button>
                    </div>
                    {rubricFile ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="truncate text-sm text-slate-700">
                          {rubricFile.name} ({formatFileSize(rubricFile.size)})
                        </p>
                        <button
                          type="button"
                          onClick={() => clearFile("rubric")}
                          className="ml-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <textarea
                    rows={10}
                    value={rubricText}
                    onChange={(event) => setRubricText(event.target.value)}
                    placeholder="Paste rubric text here"
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                )}
              </section>

              <section
                className={`rounded-2xl border bg-slate-100/80 p-4 transition md:p-5 ${
                  assignmentMode === "file" && assignmentDragOver
                    ? "-translate-y-px border-indigo-200 shadow-md ring-2 ring-indigo-100"
                    : "border-slate-200 shadow-sm"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4 text-indigo-600/70"
                      aria-hidden="true"
                    >
                      <path
                        d="m8 13.5 6.8-6.8a3 3 0 0 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <h2 className="text-base font-semibold text-slate-900">Assignment</h2>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-1">
                    <TabButton
                      active={assignmentMode === "file"}
                      onClick={() => switchAssignmentMode("file")}
                    >
                      File
                    </TabButton>
                    <TabButton
                      active={assignmentMode === "text"}
                      onClick={() => switchAssignmentMode("text")}
                    >
                      Text
                    </TabButton>
                  </div>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  Original assignment submission to be graded.
                </p>

                {assignmentMode === "file" ? (
                  <div className="space-y-3">
                    <input
                      ref={assignmentInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(event) => handleFileInputChange("assignment", event)}
                    />
                    <div
                      onDragEnter={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setAssignmentDragOver(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setAssignmentDragOver(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setAssignmentDragOver(false);
                      }}
                      onDrop={(event) => handleDrop("assignment", event, setAssignmentDragOver)}
                      className={`rounded-xl border-2 border-dashed bg-white p-5 text-center transition ${
                        assignmentDragOver
                          ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-100"
                          : "border-slate-300 hover:border-indigo-300"
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-700">Drag and drop a file here</p>
                      <p className="mt-1 text-xs text-slate-500">PDF, DOCX, or TXT up to 5MB</p>
                      <button
                        type="button"
                        onClick={() => assignmentInputRef.current?.click()}
                        className="mt-4 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        Choose File
                      </button>
                    </div>
                    {assignmentFile ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="truncate text-sm text-slate-700">
                          {assignmentFile.name} ({formatFileSize(assignmentFile.size)})
                        </p>
                        <button
                          type="button"
                          onClick={() => clearFile("assignment")}
                          className="ml-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <textarea
                    rows={10}
                    value={assignmentText}
                    onChange={(event) => setAssignmentText(event.target.value)}
                    placeholder="Paste assignment text here"
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                )}
              </section>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <span>{loadingMessage}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Grade my assignment
            </button>
          </form>
        </section>

        {gradeResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-4">
              <h2
                ref={evaluationHeadingRef}
                tabIndex={-1}
                className="text-xl font-semibold text-slate-900 focus:outline-none"
              >
                Evaluation Summary
              </h2>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estimated Score Range
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-indigo-700 md:text-4xl">
                {formatOverallScoreDisplay(gradeResult.overall_range)}{" "}
                <span className="text-xl md:text-2xl">/ 100</span>
              </p>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700 md:text-[15px]">{gradeResult.summary}</p>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Top Improvements</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {gradeResult.top_improvements.slice(0, 3).map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Criteria</th>
                    <th className="px-4 py-3 font-semibold">Max</th>
                    <th className="px-4 py-3 font-semibold">Estimated</th>
                    <th className="px-4 py-3 font-semibold">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                  {gradeResult.criteria.map((item) => (
                    <tr key={item.name}>
                      <td className="px-4 py-3 align-top font-medium">{item.name}</td>
                      <td className="px-4 py-3 align-top">{item.max_score}</td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-sm font-medium text-indigo-700">
                          {item.estimated_range[0]}&ndash;{item.estimated_range[1]}
                        </span>
                      </td>
                      <td className="max-w-[22rem] whitespace-normal break-words px-4 py-3 align-top">
                        {item.feedback}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:hidden">
              {gradeResult.criteria.map((item) => (
                <article
                  key={`${item.name}-mobile`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                    <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-sm font-medium text-indigo-700">
                      {item.estimated_range[0]}&ndash;{item.estimated_range[1]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Max score: {item.max_score}
                  </p>
                  <p className="mt-2 whitespace-normal break-words text-sm text-slate-700">
                    {item.feedback}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
