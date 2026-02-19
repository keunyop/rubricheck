"use client";

import {
  ChangeEvent,
  DragEvent,
  Fragment,
  FormEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ACTIVE_LANDING_COPY } from "../src/config/copy";

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

type CheckoutResponse = {
  url?: string;
  error?: string;
};

type EntitlementStatusResponse = {
  plan?: string;
};

const SHOW_FAKE_GRADE_BUTTON = process.env.NODE_ENV !== "production";

const FAKE_GRADE_RESULT: GradeResult = {
  title: "Demo Submission",
  overall_range: [84, 90],
  summary:
    "Your draft is logically organized and mostly aligned with the rubric. Clarifying evidence and tightening transitions should raise scoring consistency.",
  top_improvements: [
    "Add one concrete supporting example for each major claim.",
    "Strengthen paragraph transitions to improve flow between sections.",
    "Make the conclusion explicitly tie back to rubric criteria.",
  ],
  criteria: [
    {
      name: "Thesis & Focus",
      max_score: 25,
      estimated_range: [20, 23],
      feedback: "Clear thesis, but narrow the scope slightly to keep argument focus consistent.",
    },
    {
      name: "Evidence & Analysis",
      max_score: 35,
      estimated_range: [27, 31],
      feedback: "Core reasoning is sound. Add one or two concrete examples for stronger support.",
    },
    {
      name: "Organization & Coherence",
      max_score: 20,
      estimated_range: [17, 19],
      feedback: "Structure is readable; clearer transitions would further improve coherence.",
    },
    {
      name: "Language & Mechanics",
      max_score: 20,
      estimated_range: [18, 19],
      feedback: "Mostly polished writing with minor phrasing and punctuation opportunities.",
    },
  ],
};

const loadingStepLabels: Record<Exclude<LoadingStep, "idle">, string> = {
  uploading: "Uploading...",
  parsing: "Parsing files...",
  structuringRubric: "Structuring rubric...",
  evaluatingAssignment: "Reviewing your assignment against the rubric...",
};

const evaluationRotatingMessages = [
  "Reviewing your assignment against the rubric...",
  "Identifying strengths and improvement areas...",
  "Estimating a score range...",
];
const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim();
const rubricFileInputId = "rubric-file-input";
const assignmentFileInputId = "assignment-file-input";
const PRO_MONTHLY_PLAN_ID = "pro_monthly";

function formatOverallScoreDisplay(range: [number, number]): string {
  const [low, high] = range;
  if (high - low <= 5) {
    return String(Math.round((low + high) / 2));
  }

  return `${low}~${high}`;
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

function isValidEmail(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function restoreBrowserFocus() {
  if (typeof window === "undefined") {
    return;
  }

  requestAnimationFrame(() => {
    window.focus();
  });

  setTimeout(() => {
    window.focus();
  }, 120);
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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const nextWord = words[index];
    const candidate = `${currentLine} ${nextWord}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = nextWord;
    }
  }

  lines.push(currentLine);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function buildShareFallbackCanvas(result: GradeResult): HTMLCanvasElement {
  const width = 1200;
  const outerPadding = 44;
  const cardPadding = 42;
  const contentWidth = width - outerPadding * 2 - cardPadding * 2;
  const bodyLineHeight = 34;
  const smallGap = 16;
  const mediumGap = 26;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("CANVAS_CONTEXT_MISSING");
  }

  const scoreText = `${formatOverallScoreDisplay(result.overall_range)} / 100`;

  ctx.font = "400 30px system-ui, -apple-system, Segoe UI, sans-serif";
  const summaryLines = wrapCanvasText(ctx, result.summary, contentWidth);

  ctx.font = "400 30px system-ui, -apple-system, Segoe UI, sans-serif";
  const improvementLines = result.top_improvements
    .slice(0, 3)
    .map((item) => wrapCanvasText(ctx, item, contentWidth - 26));

  const criteriaLines = result.criteria.map((item) => {
    ctx.font = "700 30px system-ui, -apple-system, Segoe UI, sans-serif";
    const titleText = `${item.name} (${item.estimated_range[0]}~${item.estimated_range[1]} / ${item.max_score})`;
    const titleLines = wrapCanvasText(ctx, titleText, contentWidth - 40);

    ctx.font = "400 28px system-ui, -apple-system, Segoe UI, sans-serif";
    const feedbackLines = wrapCanvasText(ctx, item.feedback, contentWidth - 40);
    return { titleLines, feedbackLines };
  });

  const summaryHeight = Math.max(bodyLineHeight, summaryLines.length * bodyLineHeight);
  const improvementsHeight =
    improvementLines.reduce((total, lines) => total + Math.max(bodyLineHeight, lines.length * bodyLineHeight), 0) +
    mediumGap;
  const criteriaHeight =
    criteriaLines.reduce((total, item) => {
      const titleHeight = Math.max(bodyLineHeight, item.titleLines.length * bodyLineHeight);
      const feedbackHeight = Math.max(bodyLineHeight, item.feedbackLines.length * bodyLineHeight);
      return total + titleHeight + feedbackHeight + 26;
    }, 0) + mediumGap;

  const height = 540 + summaryHeight + improvementsHeight + criteriaHeight;
  canvas.width = width;
  canvas.height = height;

  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, "#e7eefc");
  bgGradient.addColorStop(1, "#f8fafc");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, outerPadding, outerPadding, width - outerPadding * 2, height - outerPadding * 2, 28);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  let cursorY = outerPadding + cardPadding;
  const textX = outerPadding + cardPadding;

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 54px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("RubriCheck Snapshot", textX, cursorY);

  cursorY += 68;
  ctx.fillStyle = "#4f46e5";
  ctx.font = "700 80px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(scoreText, textX, cursorY);

  cursorY += 46;
  ctx.fillStyle = "#64748b";
  ctx.font = "500 24px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("AI-estimated score range", textX, cursorY);

  cursorY += 52;
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Summary", textX, cursorY);

  cursorY += 40;
  ctx.fillStyle = "#334155";
  ctx.font = "400 30px system-ui, -apple-system, Segoe UI, sans-serif";
  for (const line of summaryLines) {
    ctx.fillText(line, textX, cursorY);
    cursorY += bodyLineHeight;
  }

  cursorY += mediumGap;
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Top Improvements", textX, cursorY);

  cursorY += 40;
  ctx.fillStyle = "#334155";
  ctx.font = "400 30px system-ui, -apple-system, Segoe UI, sans-serif";
  for (const lines of improvementLines) {
    if (lines.length === 0) {
      continue;
    }

    ctx.fillText("-", textX, cursorY);
    ctx.fillText(lines[0], textX + 26, cursorY);
    cursorY += bodyLineHeight;

    for (const line of lines.slice(1)) {
      ctx.fillText(line, textX + 26, cursorY);
      cursorY += bodyLineHeight;
    }
  }

  cursorY += mediumGap;
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Criteria Snapshot", textX, cursorY);

  cursorY += 34;
  for (const item of criteriaLines) {
    const cardX = textX;
    const cardY = cursorY;
    const titleHeight = Math.max(bodyLineHeight, item.titleLines.length * bodyLineHeight);
    const feedbackHeight = Math.max(bodyLineHeight, item.feedbackLines.length * bodyLineHeight);
    const itemHeight = 24 + titleHeight + smallGap + feedbackHeight + 18;

    drawRoundedRect(ctx, cardX, cardY, contentWidth, itemHeight, 16);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let itemY = cardY + 36;
    ctx.fillStyle = "#1e293b";
    ctx.font = "700 30px system-ui, -apple-system, Segoe UI, sans-serif";
    for (const line of item.titleLines) {
      ctx.fillText(line, cardX + 20, itemY);
      itemY += bodyLineHeight;
    }

    itemY += 6;
    ctx.fillStyle = "#334155";
    ctx.font = "400 28px system-ui, -apple-system, Segoe UI, sans-serif";
    for (const line of item.feedbackLines) {
      ctx.fillText(line, cardX + 20, itemY);
      itemY += bodyLineHeight;
    }

    cursorY += itemHeight + 14;
  }

  return canvas;
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
  const [showDailyLimitAlert, setShowDailyLimitAlert] = useState(false);
  const [dailyLimitValue, setDailyLimitValue] = useState<number | null>(null);
  const [evaluationMessageIndex, setEvaluationMessageIndex] = useState(0);
  const [showRewritePaywall, setShowRewritePaywall] = useState(false);
  const [expandedRewriteSections, setExpandedRewriteSections] = useState<Record<string, boolean>>(
    {},
  );
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [didCopyImage, setDidCopyImage] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [hasProAccess, setHasProAccess] = useState(false);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = loadingStep !== "idle";

  const loadingMessage = useMemo(() => {
    if (loadingStep === "idle") {
      return "";
    }

    if (loadingStep === "evaluatingAssignment") {
      return evaluationRotatingMessages[evaluationMessageIndex];
    }

    return loadingStepLabels[loadingStep];
  }, [evaluationMessageIndex, loadingStep]);

  useEffect(() => {
    if (loadingStep !== "evaluatingAssignment") {
      setEvaluationMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setEvaluationMessageIndex((prev) => (prev + 1) % evaluationRotatingMessages.length);
    }, 1200);

    return () => {
      clearInterval(interval);
    };
  }, [loadingStep]);

  useEffect(() => {
    if (!gradeResult || !evaluationHeadingRef.current) {
      return;
    }

    evaluationHeadingRef.current.focus();
    evaluationHeadingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    window.getSelection()?.removeAllRanges();
  }, [gradeResult]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function syncEntitlementStatus() {
      try {
        const response = await fetch("/api/entitlement", {
          method: "GET",
          cache: "no-store",
        });
        const data: EntitlementStatusResponse = await response.json().catch(() => ({}));
        if (!canceled) {
          setHasProAccess(response.ok && data.plan === "pro");
        }
      } catch {
        if (!canceled) {
          setHasProAccess(false);
        }
      }
    }

    void syncEntitlementStatus();

    return () => {
      canceled = true;
    };
  }, []);

  function openRewritePaywall() {
    if (hasProAccess) {
      setCheckoutError("");
      setShowRewritePaywall(false);
      return;
    }

    setCheckoutError("");
    setShowRewritePaywall(true);
  }

  function closeRewritePaywall() {
    setCheckoutError("");
    setShowRewritePaywall(false);
  }

  function toggleRewriteSection(criteriaKey: string) {
    setExpandedRewriteSections((previous) => ({
      ...previous,
      [criteriaKey]: !previous[criteriaKey],
    }));
  }

  async function handleShareResultsImage() {
    if (!gradeResult) {
      return;
    }

    setIsSharingImage(true);
    setDidCopyImage(false);

    try {
      const canvas = buildShareFallbackCanvas(gradeResult);

      let imageBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), "image/png");
      });

      if (!imageBlob) {
        const dataUrl = canvas.toDataURL("image/png");
        const dataResponse = await fetch(dataUrl);
        imageBlob = await dataResponse.blob();
      }

      if (!imageBlob || imageBlob.size === 0) {
        throw new Error("IMAGE_BLOB_EMPTY");
      }

      const clipboardApi = navigator.clipboard;
      const clipboardItemCtor = (
        window as Window & { ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem }
      ).ClipboardItem;

      if (clipboardApi?.write && clipboardItemCtor) {
        try {
          await clipboardApi.write([new clipboardItemCtor({ "image/png": imageBlob })]);
          setDidCopyImage(true);
          if (copyResetTimerRef.current) {
            clearTimeout(copyResetTimerRef.current);
          }
          copyResetTimerRef.current = setTimeout(() => {
            setDidCopyImage(false);
          }, 1800);
          return;
        } catch {
          // Fallback to file download when clipboard image write is blocked.
        }
      }

      const pngUrl = URL.createObjectURL(imageBlob);
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = `rubricheck-summary-${new Date().toISOString().slice(0, 10)}.png`;
      if ("download" in HTMLAnchorElement.prototype) {
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(pngUrl, "_blank", "noopener,noreferrer");
      }

      setTimeout(() => {
        URL.revokeObjectURL(pngUrl);
      }, 30_000);
    } catch {
      setDidCopyImage(false);
    } finally {
      setIsSharingImage(false);
    }
  }

  async function handleUpgradeToPro() {
    setCheckoutError("");
    const normalizedEmail = checkoutEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setCheckoutError("Please enter a valid email for Stripe checkout.");
      return;
    }

    setIsCreatingCheckout(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId: PRO_MONTHLY_PLAN_ID, email: normalizedEmail }),
      });

      const data: CheckoutResponse = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "CHECKOUT_SESSION_FAILED");
      }

      window.location.assign(data.url);
    } catch {
      setCheckoutError("Unable to start checkout right now. Please try again.");
    } finally {
      setIsCreatingCheckout(false);
    }
  }

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
      restoreBrowserFocus();
      return;
    }

    applyFileSelection(field, selectedFile);
    restoreBrowserFocus();
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

    if (message === "SERVICE_UNAVAILABLE") {
      return "Service is temporarily unavailable. Please try again shortly.";
    }

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
    setShowDailyLimitAlert(false);
    setDailyLimitValue(null);
    setGradeResult(null);
    setShowRewritePaywall(false);
    setExpandedRewriteSections({});
    setIsSharingImage(false);
    setDidCopyImage(false);

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

      const apiError =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error ?? "")
          : "";
      const limitHeaderRaw = response.headers.get("x-ratelimit-limit");
      const limitFromHeader = limitHeaderRaw ? Number.parseInt(limitHeaderRaw, 10) : Number.NaN;
      const limitFromErrorMatch = apiError.match(/(?:Free )?daily limit reached \((\d+)\)/i);
      const limitFromError = limitFromErrorMatch?.[1]
        ? Number.parseInt(limitFromErrorMatch[1], 10)
        : Number.NaN;
      const detectedDailyLimit =
        Number.isFinite(limitFromHeader) && limitFromHeader > 0
          ? limitFromHeader
          : Number.isFinite(limitFromError) && limitFromError > 0
            ? limitFromError
            : null;
      const isDailyLimitHit =
        response.status === 429 ||
        apiError.toLowerCase().startsWith("daily limit reached") ||
        apiError.toLowerCase().startsWith("free daily limit reached");

      if (isDailyLimitHit) {
        setDailyLimitValue(detectedDailyLimit);
        setShowDailyLimitAlert(true);
        setError("");
        return;
      }

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

  function handleRunFakeGrade() {
    setError("");
    setShowDailyLimitAlert(false);
    setDailyLimitValue(null);
    setShowRewritePaywall(false);
    setExpandedRewriteSections({});
    setIsSharingImage(false);
    setDidCopyImage(false);
    setLoadingStep("idle");
    setGradeResult(FAKE_GRADE_RESULT);
  }

  return (
    <main className="min-h-screen bg-slate-300 px-4 py-10 md:py-14">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {ACTIVE_LANDING_COPY.headline}
              </h1>
              <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                Beta
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 md:text-[15px]">
              {ACTIVE_LANDING_COPY.subtitle}
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
                      id={rubricFileInputId}
                      ref={rubricInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onBlur={restoreBrowserFocus}
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
                      <label
                        htmlFor={rubricFileInputId}
                        className="mt-4 inline-flex cursor-pointer rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        Choose File
                      </label>
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
                      id={assignmentFileInputId}
                      ref={assignmentInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onBlur={restoreBrowserFocus}
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
                      <label
                        htmlFor={assignmentFileInputId}
                        className="mt-4 inline-flex cursor-pointer rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        Choose File
                      </label>
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
              <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600 md:text-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <span className="leading-5">{loadingMessage}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-indigo-500 active:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Grade my assignment
            </button>
            {SHOW_FAKE_GRADE_BUTTON ? (
              <button
                type="button"
                onClick={handleRunFakeGrade}
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run fake grade (dev)
              </button>
            ) : null}
          </form>
        </section>

        {showDailyLimitAlert ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm md:p-6">
            <h2 className="text-base font-semibold text-amber-900">Daily limit reached</h2>
            <p className="mt-1 text-sm text-amber-800">
              {dailyLimitValue
                ? `You've used all ${dailyLimitValue} checks for today. Please try again tomorrow.`
                : "You've reached today's check limit. Please try again tomorrow."}
            </p>
          </section>
        ) : null}

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

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estimated Score Range
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-indigo-700 md:text-4xl">
                      {formatOverallScoreDisplay(gradeResult.overall_range)}{" "}
                      <span className="text-xl md:text-2xl">/ 100</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleShareResultsImage}
                    data-html2canvas-ignore="true"
                    disabled={isSharingImage}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                  >
                    {isSharingImage ? "Preparing image..." : didCopyImage ? "Copied" : "Share"}
                  </button>
                </div>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 md:text-sm">
                  This is an AI-estimated range based on your rubric. Use it as guidance before
                  submission.
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

            </div>

            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5">
              <button
                type="button"
                onClick={openRewritePaywall}
                disabled={hasProAccess}
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 md:w-auto"
              >
                {hasProAccess ? "Pro Active on This Device" : "Unlock Rewrite Mode"}
              </button>
              <p className="mt-2 text-xs leading-5 text-indigo-900/80 md:text-sm">
                {hasProAccess
                  ? "Pro entitlement is active. Rewrite/simulate gates now use your Pro session."
                  : "Pro helps you improve specific criteria with ready-to-use paragraph rewrites."}
              </p>
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
                  {gradeResult.criteria.map((item, index) => {
                    const criteriaKey = `criteria-${index}-${item.name}`;
                    const isRewriteOpen = Boolean(expandedRewriteSections[criteriaKey]);

                    return (
                      <Fragment key={criteriaKey}>
                        <tr>
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
                        <tr>
                          <td colSpan={4} className="px-4 pb-4 pt-0">
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80">
                              <button
                                type="button"
                                onClick={() => toggleRewriteSection(criteriaKey)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100/70"
                              >
                                <span>Rewrite suggestions (Pro)</span>
                                <span className="text-xs font-medium text-slate-500">
                                  {isRewriteOpen ? "Hide" : "Show"}
                                </span>
                              </button>
                              {isRewriteOpen ? (
                                <div className="border-t border-slate-200 px-3 py-3">
                                  {hasProAccess ? (
                                    <p className="text-sm text-emerald-700">
                                      Pro is active on this device.
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-sm text-slate-600">
                                        Rewrite Mode is a Pro feature. Upgrade to Pro to unlock it.
                                      </p>
                                      <button
                                        type="button"
                                        onClick={openRewritePaywall}
                                        className="mt-3 inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                      >
                                        Upgrade to Pro
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:hidden">
              {gradeResult.criteria.map((item, index) => {
                const criteriaKey = `criteria-${index}-${item.name}`;
                const isRewriteOpen = Boolean(expandedRewriteSections[criteriaKey]);

                return (
                  <article
                    key={`${item.name}-mobile-${index}`}
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

                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white/80">
                      <button
                        type="button"
                        onClick={() => toggleRewriteSection(criteriaKey)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100/70"
                      >
                        <span>Rewrite suggestions (Pro)</span>
                        <span className="text-xs font-medium text-slate-500">
                          {isRewriteOpen ? "Hide" : "Show"}
                        </span>
                      </button>
                      {isRewriteOpen ? (
                        <div className="border-t border-slate-200 px-3 py-3">
                          {hasProAccess ? (
                            <p className="text-sm text-emerald-700">
                              Pro is active on this device.
                            </p>
                          ) : (
                            <>
                              <p className="text-sm text-slate-600">
                                Rewrite Mode is a Pro feature. Upgrade to Pro to unlock it.
                              </p>
                              <button
                                type="button"
                                onClick={openRewritePaywall}
                                className="mt-3 inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                              >
                                Upgrade to Pro
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {showRewritePaywall && !hasProAccess ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close rewrite mode paywall"
              onClick={closeRewritePaywall}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="rewrite-mode-title"
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <h3 id="rewrite-mode-title" className="text-lg font-semibold text-slate-900">
                Upgrade to Pro
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Pro monthly unlocks Rewrite Mode. Enter your email and continue to Stripe Checkout.
              </p>
              <label htmlFor="upgrade-email" className="mt-4 block">
                <span className="text-xs font-semibold text-slate-700">Email</span>
                <input
                  id="upgrade-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={checkoutEmail}
                  onChange={(event) => {
                    setCheckoutEmail(event.target.value);
                    setCheckoutError("");
                  }}
                  disabled={isCreatingCheckout}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
              {checkoutError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {checkoutError}
                </p>
              ) : null}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeRewritePaywall}
                  disabled={isCreatingCheckout}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleUpgradeToPro}
                  disabled={isCreatingCheckout || !checkoutEmail.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingCheckout ? "Redirecting..." : "Upgrade to Pro"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {feedbackUrl ? (
          <footer className="pt-1 text-center text-xs text-slate-500">
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-800"
            >
              Feedback
            </a>
          </footer>
        ) : null}
      </div>
    </main>
  );
}
