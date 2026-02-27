"use client";

import {
  ChangeEvent,
  DragEvent,
  Fragment,
  FormEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { ACTIVE_LANDING_COPY } from "../src/config/copy";
import { PRO_CHECKOUT_DISPLAY, type ProCheckoutPlan } from "../src/config/proCheckout";
import { getEvaluateInterstitialDecision } from "../src/lib/evaluateInterstitial";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

type InputMode = "file" | "text";
type InputField = "rubric" | "assignment";
type GradingMode = "standard" | "strict";
type LoadingStep =
  | "idle"
  | "uploading"
  | "parsing"
  | "structuringRubric"
  | "evaluatingAssignment";

type GradeErrorResponse = {
  code?: string;
  action?: string;
  freeLimit?: number;
  error?: string;
  message?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  field?: "rubric" | "assignment";
};

type EvaluationDraftSnapshot = {
  rubricMode: InputMode;
  assignmentMode: InputMode;
  rubricText: string;
  assignmentText: string;
  gradingMode: GradingMode;
  hadRubricFile: boolean;
  hadAssignmentFile: boolean;
  savedAt: number;
};

type StoredEvaluationResultSnapshot = {
  gradeResult: GradeResult;
  resultMode: GradingMode | null;
  savedAt: number;
};

type CriteriaResult = {
  name: string;
  max_score: number;
  score?: number;
  rationale?: string;
  estimated_range: [number, number];
  feedback: string;
  evidence?: string[];
  detailed_breakdown?: string;
  example_revisions?: string[];
  detailed_breakdown_locked?: boolean;
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
  plan?: string;
  packId?: string;
  code?: string;
  message?: string;
  error?: string;
};

type AccountSummaryResponse = {
  signedIn?: boolean;
  email?: string | null;
  plan?: "free" | "pro";
  remainingEvaluations?: number | null;
  creditsBalance?: number | null;
  error?: string;
};

type EntitlementStatusResponse = {
  plan?: string;
  status?: string;
};

type RestoreStartResponse = {
  ok?: boolean;
  message?: string;
  devCode?: string;
  code?: string;
  error?: string;
};

type RestoreVerifyResponse = {
  ok?: boolean;
  plan?: string;
  status?: string;
  code?: string;
  message?: string;
  error?: string;
};

type PaywallMode = "restore" | "upgrade";
type RestoreStep = "email" | "code";

const NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() ?? "development";
const NEXT_PUBLIC_VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim().toLowerCase() ?? "";
const NODE_ENV = process.env.NODE_ENV?.trim().toLowerCase() ?? "";
const IS_PRODUCTION_APP_ENV = NEXT_PUBLIC_APP_ENV === "production";
const SHOW_PRO_FEATURES = !IS_PRODUCTION_APP_ENV;
const SHOW_PRICING_BUTTON = NODE_ENV !== "production";
const SHOW_BETA_BADGE = IS_PRODUCTION_APP_ENV;

const FOOTER_LEGAL_LINKS = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "AI Disclaimer", href: "/legal/ai-disclaimer" },
  { label: "Data Retention", href: "/legal/data-retention" },
] as const;

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
const GRADING_MODE_STORAGE_KEY = "rubricheck_grading_mode";
const LOCKED_DETAILED_FEEDBACK_NOTICE = "Detailed criterion breakdown is available with Pro.";
const FREE_EVALUATIONS_PER_DAY = 3;
const EVALUATION_DRAFT_STORAGE_KEY = "rubricheck_evaluation_draft_v1";
const EVALUATION_DRAFT_TTL_MS = 1000 * 60 * 60 * 24;
const EVALUATION_RESULT_STORAGE_KEY = "rubricheck_evaluation_result_v1";
const EVALUATION_RESULT_TTL_MS = 1000 * 60 * 60 * 24;
const EMAIL_AVATAR_CLASS_NAME = "border-indigo-200 bg-indigo-100 text-indigo-700";

function splitDetailedBreakdownBullets(value: string): string[] {
  return value
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[\-*]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 5);
}

function formatOverallScoreDisplay(range: [number, number]): string {
  const [low, high] = range;
  if (high - low <= 5) {
    return String(Math.round((low + high) / 2));
  }

  return `${low}~${high}`;
}

function formatEstimatedRangeDisplay(range: [number, number], separator: "~" | "-"): string {
  const [low, high] = range;
  if (low === high) {
    return String(low);
  }

  return `${low}${separator}${high}`;
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

function getEmailInitial(email: string): string {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return "?";
  }

  const firstCharacter = normalizedEmail.charAt(0).toUpperCase();
  return /^[A-Z0-9]$/.test(firstCharacter) ? firstCharacter : "?";
}

function getEmailInitialAvatarClassName(email: string): string {
  if (!email.trim()) {
    return EMAIL_AVATAR_CLASS_NAME;
  }

  return EMAIL_AVATAR_CLASS_NAME;
}

function getEvaluationStatusChip(plan: "free" | "pro", remainingEvaluations: number | null): {
  label: string;
  toneClassName: string;
} | null {
  if (plan === "pro") {
    return null;
  }

  if (typeof remainingEvaluations === "number") {
    if (remainingEvaluations <= 0) {
      return {
        label: "No evaluations left today",
        toneClassName: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    return {
      label: `${remainingEvaluations} evaluations left`,
      toneClassName: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "Remaining evaluations -",
    toneClassName: "border-slate-200 bg-slate-50 text-slate-600",
  };
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

function shouldShowEnvDebugFooter(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("debug") === "1";
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
    const estimatedRangeText = formatEstimatedRangeDisplay(item.estimated_range, "~");
    const titleText = `${item.name} (${estimatedRangeText} / ${item.max_score})`;
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
  const [gradingMode, setGradingMode] = useState<GradingMode>("standard");
  const [resultMode, setResultMode] = useState<GradingMode | null>(null);

  const [rubricDragOver, setRubricDragOver] = useState(false);
  const [assignmentDragOver, setAssignmentDragOver] = useState(false);

  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [lastRequestId, setLastRequestId] = useState("");
  const [openAiTimeoutCount, setOpenAiTimeoutCount] = useState(0);
  const [showRedisWarning, setShowRedisWarning] = useState(false);
  const [showDailyLimitAlert, setShowDailyLimitAlert] = useState(false);
  const [dailyLimitValue, setDailyLimitValue] = useState<number | null>(null);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [accountPlan, setAccountPlan] = useState<"free" | "pro">("free");
  const [remainingEvaluations, setRemainingEvaluations] = useState<number | null>(null);
  const [evaluationMessageIndex, setEvaluationMessageIndex] = useState(0);
  const [showRewritePaywall, setShowRewritePaywall] = useState(false);
  const [expandedRewriteSections, setExpandedRewriteSections] = useState<Record<string, boolean>>(
    {},
  );
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [didCopyImage, setDidCopyImage] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<ProCheckoutPlan>("monthly");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [hasProAccess, setHasProAccess] = useState(false);
  const [entitlementStatus, setEntitlementStatus] = useState<"active" | "needs_restore">("needs_restore");
  const [paywallMode, setPaywallMode] = useState<PaywallMode>("restore");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [restoreStep, setRestoreStep] = useState<RestoreStep>("email");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreInfo, setRestoreInfo] = useState("");
  const [isStartingRestore, setIsStartingRestore] = useState(false);
  const [isVerifyingRestore, setIsVerifyingRestore] = useState(false);
  const [proRestoreNotice, setProRestoreNotice] = useState("");
  const [showEnvDebugFooter, setShowEnvDebugFooter] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [shouldFocusEvaluationHeading, setShouldFocusEvaluationHeading] = useState(false);
  const evaluationStatusChip = getEvaluationStatusChip(accountPlan, remainingEvaluations);
  const [draftRestoreNotice, setDraftRestoreNotice] = useState("");
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const isLoading = loadingStep !== "idle";
  const selectedCheckoutPlanDisplay = PRO_CHECKOUT_DISPLAY[checkoutPlan];

  const loadingMessage = useMemo(() => {
    if (loadingStep === "idle") {
      return "";
    }

    if (loadingStep === "evaluatingAssignment") {
      return evaluationRotatingMessages[evaluationMessageIndex];
    }

    return loadingStepLabels[loadingStep];
  }, [evaluationMessageIndex, loadingStep]);

  const refreshAccountSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/account/summary", {
        method: "GET",
        cache: "no-store",
      });
      const data: AccountSummaryResponse = await response.json().catch(() => ({}));
      const email = typeof data.email === "string" ? data.email.trim() : "";
      const remaining =
        typeof data.remainingEvaluations === "number" && Number.isFinite(data.remainingEvaluations)
          ? Math.max(0, Math.floor(data.remainingEvaluations))
          : null;
      if (response.ok && data.signedIn && email) {
        setSignedInEmail(email);
        setAccountPlan(data.plan === "pro" ? "pro" : "free");
        setRemainingEvaluations(remaining);
      } else {
        setSignedInEmail("");
        setAccountPlan("free");
        setRemainingEvaluations(null);
      }
    } catch {
      setSignedInEmail("");
      setAccountPlan("free");
      setRemainingEvaluations(null);
    }
  }, []);

  function openLoginModal() {
    setShowAccountMenu(false);
    setRestoreStep("email");
    setRestoreCode("");
    setRestoreError("");
    setRestoreInfo("");
    setShowLoginModal(true);
  }

  function persistEvaluationDraftForCheckout() {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot: EvaluationDraftSnapshot = {
      rubricMode,
      assignmentMode,
      rubricText: rubricText.trim(),
      assignmentText: assignmentText.trim(),
      gradingMode,
      hadRubricFile: rubricFile !== null,
      hadAssignmentFile: assignmentFile !== null,
      savedAt: Date.now(),
    };

    try {
      window.localStorage.setItem(EVALUATION_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota/private mode storage failures.
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedMode = window.localStorage.getItem(GRADING_MODE_STORAGE_KEY);
    if (storedMode === "standard" || storedMode === "strict") {
      setGradingMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawStoredResult = window.localStorage.getItem(EVALUATION_RESULT_STORAGE_KEY);
    if (!rawStoredResult) {
      return;
    }

    try {
      const parsed = JSON.parse(rawStoredResult) as Partial<StoredEvaluationResultSnapshot>;
      const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
      if (!savedAt || Date.now() - savedAt > EVALUATION_RESULT_TTL_MS) {
        window.localStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
        return;
      }

      const storedMode =
        parsed.resultMode === "standard" || parsed.resultMode === "strict" ? parsed.resultMode : null;
      const candidateResult = parsed.gradeResult;
      if (!candidateResult || typeof candidateResult !== "object") {
        return;
      }

      const modeForValidation = storedMode ?? "standard";
      if (!isGradeResult(candidateResult, modeForValidation)) {
        return;
      }

      setGradeResult(candidateResult);
      setResultMode(storedMode);
    } catch {
      window.localStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!gradeResult) {
      window.localStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
      return;
    }

    const snapshot: StoredEvaluationResultSnapshot = {
      gradeResult,
      resultMode,
      savedAt: Date.now(),
    };

    try {
      window.localStorage.setItem(EVALUATION_RESULT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota/private mode storage failures.
    }
  }, [gradeResult, resultMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawDraft = window.localStorage.getItem(EVALUATION_DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      return;
    }

    window.localStorage.removeItem(EVALUATION_DRAFT_STORAGE_KEY);

    try {
      const parsed = JSON.parse(rawDraft) as Partial<EvaluationDraftSnapshot>;
      const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
      if (!savedAt || Date.now() - savedAt > EVALUATION_DRAFT_TTL_MS) {
        return;
      }

      const restoredRubricText = typeof parsed.rubricText === "string" ? parsed.rubricText : "";
      const restoredAssignmentText = typeof parsed.assignmentText === "string" ? parsed.assignmentText : "";

      if (restoredRubricText) {
        setRubricMode("text");
        setRubricText(restoredRubricText);
      }

      if (restoredAssignmentText) {
        setAssignmentMode("text");
        setAssignmentText(restoredAssignmentText);
      }

      if (parsed.gradingMode === "standard" || parsed.gradingMode === "strict") {
        setGradingMode(parsed.gradingMode);
      }

      const hadRubricFile = parsed.hadRubricFile === true;
      const hadAssignmentFile = parsed.hadAssignmentFile === true;
      if (hadRubricFile || hadAssignmentFile) {
        setDraftRestoreNotice(
          restoredRubricText || restoredAssignmentText
            ? "Text inputs were restored. Re-select files before running evaluate again."
            : "Previous file selections cannot be restored. Please re-select files before running evaluate again.",
        );
      } else if (restoredRubricText || restoredAssignmentText) {
        setDraftRestoreNotice("Your text inputs were restored so you can run evaluate again.");
      }
    } catch {
      // Ignore invalid cached drafts.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(GRADING_MODE_STORAGE_KEY, gradingMode);
  }, [gradingMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncDebugFlag = () => {
      setShowEnvDebugFooter(shouldShowEnvDebugFooter());
    };

    syncDebugFlag();
    window.addEventListener("popstate", syncDebugFlag);
    return () => {
      window.removeEventListener("popstate", syncDebugFlag);
    };
  }, []);

  useEffect(() => {
    void refreshAccountSummary();
  }, [refreshAccountSummary]);

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

    if (!shouldFocusEvaluationHeading) {
      return;
    }

    setShouldFocusEvaluationHeading(false);
    evaluationHeadingRef.current.focus();
    evaluationHeadingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    window.getSelection()?.removeAllRanges();
  }, [gradeResult, shouldFocusEvaluationHeading]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showAccountMenu) {
      return;
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode || !accountMenuRef.current?.contains(targetNode)) {
        setShowAccountMenu(false);
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [showAccountMenu]);

  useEffect(() => {
    if (!SHOW_PRO_FEATURES) {
      setHasProAccess(false);
      setEntitlementStatus("needs_restore");
      return;
    }

    let canceled = false;

    async function syncEntitlementStatus() {
      try {
        const response = await fetch("/api/entitlement", {
          method: "GET",
          cache: "no-store",
        });
        const data: EntitlementStatusResponse = await response.json().catch(() => ({}));
        if (!canceled) {
          const isActive = response.ok && data.plan === "pro" && data.status === "active";
          setHasProAccess(isActive);
          setEntitlementStatus(isActive ? "active" : "needs_restore");
        }
      } catch {
        if (!canceled) {
          setHasProAccess(false);
          setEntitlementStatus("needs_restore");
        }
      }
    }

    void syncEntitlementStatus();

    return () => {
      canceled = true;
    };
  }, []);

  function openRewritePaywall(mode: PaywallMode = "restore") {
    if (!SHOW_PRO_FEATURES) {
      return;
    }

    setShowLoginModal(false);

    if (hasProAccess) {
      setCheckoutError("");
      setRestoreError("");
      setShowRewritePaywall(false);
      return;
    }

    setCheckoutError("");
    setRestoreError("");
    setRestoreInfo("");
    setPaywallMode(mode);
    if (mode === "restore") {
      setRestoreStep("email");
      setRestoreCode("");
    } else {
      setCheckoutPlan("monthly");
    }
    setShowRewritePaywall(true);
  }

  function closeRewritePaywall() {
    setCheckoutError("");
    setRestoreError("");
    setRestoreInfo("");
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
        body: JSON.stringify({ plan: checkoutPlan, email: normalizedEmail }),
      });

      const data: CheckoutResponse = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.code ?? data.error ?? "CHECKOUT_SESSION_FAILED");
      }

      persistEvaluationDraftForCheckout();
      window.location.assign(data.url);
    } catch (error) {
      const code = error instanceof Error ? error.message : "CHECKOUT_SESSION_FAILED";
      if (code === "ALREADY_PRO_ACTIVE") {
        setCheckoutError("This email already has an active Pro subscription. Please log in instead of purchasing again.");
      } else {
        setCheckoutError("Unable to start checkout right now. Please try again.");
      }
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
    const message = data.code ?? data.error;

    if (message === "OPENAI_TIMEOUT") {
      return "The AI review is taking longer than expected. Please retry.";
    }

    if (message === "REDIS_UNAVAILABLE") {
      return "We are temporarily verifying limits in safe mode. Please retry shortly.";
    }

    if (message === "SERVICE_UNAVAILABLE") {
      return "Service is temporarily unavailable. Please try again shortly.";
    }

    if (message === "MISSING_INPUT") {
      return "Please provide both a rubric and an assignment.";
    }

    if (message === "FILE_PARSE_FAILED" || message === "TEXT_EXTRACTION_FAILED") {
      const target = data.field === "rubric" ? "Rubric" : "Assignment";
      return `Text extraction failed for ${target}. Please upload a text-based PDF/DOCX or paste the text.`;
    }

    if (message === "UNSUPPORTED_FILE_TYPE") {
      return "Unsupported file type. Please upload PDF, DOCX, or TXT.";
    }

    if (message === "FILE_TOO_LARGE") {
      return "File is too large. Max size is 5MB.";
    }

    if (message === "INVALID_MODE") {
      return "Invalid grading mode. Please select Standard or Strict Mode.";
    }

    if (message === "INVALID_JSON" || message === "INVALID_INPUT") {
      return "Please provide valid rubric and assignment inputs.";
    }

    if (message === "FREE_LIMIT_REACHED") {
      return "You've used today's free evaluations. Upgrade to Pro or buy credits to continue.";
    }

    return "Something went wrong. Please try again.";
  }

  function isGradeResult(value: unknown, mode: GradingMode): value is GradeResult {
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
          (row.score === undefined || typeof row.score === "number") &&
          (row.rationale === undefined || typeof row.rationale === "string") &&
          Array.isArray(row.estimated_range) &&
          row.estimated_range.length === 2 &&
          row.estimated_range.every((value) => typeof value === "number") &&
          typeof row.feedback === "string" &&
          (row.detailed_breakdown_locked === undefined || typeof row.detailed_breakdown_locked === "boolean") &&
          (row.example_revisions === undefined ||
            (Array.isArray(row.example_revisions) &&
              row.example_revisions.length >= 1 &&
              row.example_revisions.length <= 2 &&
              row.example_revisions.every(
                (revision) => typeof revision === "string" && revision.trim().length > 0,
              ))) &&
          (row.evidence === undefined ||
            (Array.isArray(row.evidence) &&
              row.evidence.length >= 1 &&
              row.evidence.length <= 2 &&
              row.evidence.every((snippet) => typeof snippet === "string" && snippet.trim().length > 0)))
        );
      });

    const hasStrictEvidence =
      mode !== "strict" ||
      (Array.isArray(candidate.criteria) &&
        candidate.criteria.every(
          (item) =>
            Array.isArray(item.evidence) &&
            item.evidence.length >= 1 &&
            item.evidence.length <= 2 &&
            item.evidence.every((snippet) => typeof snippet === "string" && snippet.trim().length > 0),
        ));

    return hasTitle && hasSummary && hasOverallRange && hasTopImprovements && hasCriteria && hasStrictEvidence;
  }

  async function submitGrade(selectedMode: GradingMode) {
    if (isLoading) {
      return;
    }

    setGradingMode(selectedMode);
    setError("");
    setErrorCode("");
    setLastRequestId("");
    setShowRedisWarning(false);
    setShowDailyLimitAlert(false);
    setDraftRestoreNotice("");
    setCheckoutError("");
    setDailyLimitValue(null);
    setShouldFocusEvaluationHeading(false);
    setGradeResult(null);
    setResultMode(null);
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
      let requestPromise: Promise<Response>;

      if (rubricMode === "text" && assignmentMode === "text") {
        requestPromise = fetch("/api/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rubricText: rubricText.trim(),
            assignmentText: assignmentText.trim(),
            mode: selectedMode,
          }),
        });
      } else {
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

        formData.append("mode", selectedMode);

        requestPromise = fetch("/api/evaluate", {
          method: "POST",
          body: formData,
        });
      }

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
      void refreshAccountSummary();

      const apiErrorResponse = (data ?? {}) as GradeErrorResponse;
      setLastRequestId(response.headers.get("x-request-id") ?? apiErrorResponse.requestId ?? "");
      setShowRedisWarning(response.headers.get("x-rubricheck-warning") === "REDIS_UNAVAILABLE");
      const apiError =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error ?? "")
          : "";
      const apiCode =
        data && typeof data === "object" && "code" in data
          ? String((data as { code?: unknown }).code ?? "")
          : "";
      const apiMessage =
        data && typeof data === "object" && "message" in data
          ? String((data as { message?: unknown }).message ?? "")
          : "";
      const limitHeaderRaw = response.headers.get("x-ratelimit-limit");
      const limitFromHeader = limitHeaderRaw ? Number.parseInt(limitHeaderRaw, 10) : Number.NaN;
      const limitFromErrorMatch = (apiMessage || apiError).match(/(?:Free )?daily limit reached \((\d+)\)/i);
      const limitFromError = limitFromErrorMatch?.[1]
        ? Number.parseInt(limitFromErrorMatch[1], 10)
        : Number.NaN;
      const detectedDailyLimit =
        Number.isFinite(limitFromHeader) && limitFromHeader > 0
          ? limitFromHeader
          : Number.isFinite(limitFromError) && limitFromError > 0
            ? limitFromError
            : null;
      const interstitialDecision = getEvaluateInterstitialDecision({
        status: response.status,
        payload: apiErrorResponse,
        fallbackLimit: detectedDailyLimit ?? FREE_EVALUATIONS_PER_DAY,
      });

      if (interstitialDecision.show) {
        setDailyLimitValue(interstitialDecision.freeLimit ?? FREE_EVALUATIONS_PER_DAY);
        setShowDailyLimitAlert(true);
        setError("");
        return;
      }

      if (!response.ok) {
        setError(mapApiError((data ?? {}) as GradeErrorResponse));
        setErrorCode(apiCode || apiError);
        if ((apiCode || apiError) === "OPENAI_TIMEOUT") {
          setOpenAiTimeoutCount((prev) => prev + 1);
        }
        return;
      }

      setOpenAiTimeoutCount(0);

      if (!isGradeResult(data, selectedMode)) {
        setError("Something went wrong. Please try again.");
        return;
      }

      setShouldFocusEvaluationHeading(true);
      setGradeResult(data);
      setResultMode(selectedMode);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      for (const timer of stepTimers) {
        clearTimeout(timer);
      }
      setLoadingStep("idle");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitGrade("standard");
  }

  function handleStrictSubmit() {
    void submitGrade("strict");
  }

  async function handleLogout() {
    setShowAccountMenu(false);

    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      // Ignore network/logout failures and reset local session state.
    }

    setSignedInEmail("");
    setAccountPlan("free");
    setRemainingEvaluations(null);
    setHasProAccess(false);
    setEntitlementStatus("needs_restore");
    setProRestoreNotice("");
    setShowLoginModal(false);
    setShowRewritePaywall(false);
    setRestoreStep("email");
    setRestoreCode("");
    setRestoreError("");
    setRestoreInfo("");
    setGradeResult(null);
    setResultMode(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
    }
  }

  async function handleStartRestorePro() {
    setRestoreError("");
    setRestoreInfo("");

    const normalizedEmail = restoreEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setRestoreError("Please enter a valid email.");
      return;
    }

    setIsStartingRestore(true);
    try {
      const response = await fetch("/api/entitlement/restore/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data: RestoreStartResponse = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? data.code ?? "ENTITLEMENT_RESTORE_START_FAILED");
      }

      setRestoreEmail(normalizedEmail);
      setCheckoutEmail((previous) => previous || normalizedEmail);
      setRestoreStep("code");
      if (typeof data.devCode === "string" && /^\d{6}$/.test(data.devCode)) {
        setRestoreCode(data.devCode);
        setRestoreInfo(`Development code: ${data.devCode}`);
      } else {
        setRestoreInfo(data.message ?? "If that email can receive recovery codes, a code has been sent.");
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_RESTORE_START_FAILED";
      if (code === "RATE_LIMITED") {
        setRestoreError("Too many requests. Please wait and try again.");
        return;
      }

      if (code === "SERVICE_UNAVAILABLE") {
        setRestoreError("Restore is temporarily unavailable. Please try again shortly.");
        return;
      }

      setRestoreError("Unable to start restore right now. Please try again.");
    } finally {
      setIsStartingRestore(false);
    }
  }

  async function handleVerifyRestorePro() {
    setRestoreError("");
    setRestoreInfo("");

    const normalizedEmail = restoreEmail.trim().toLowerCase();
    const normalizedCode = restoreCode.trim();

    if (!isValidEmail(normalizedEmail)) {
      setRestoreError("Please enter a valid email.");
      setRestoreStep("email");
      return;
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      setRestoreError("Enter the 6-digit code.");
      return;
    }

    setIsVerifyingRestore(true);
    try {
      const response = await fetch("/api/entitlement/restore/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });

      const data: RestoreVerifyResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? data.code ?? "ENTITLEMENT_RESTORE_VERIFY_FAILED");
      }

      if (data.ok === true && data.plan === "pro" && data.status === "active") {
        setHasProAccess(true);
        setEntitlementStatus("active");
        setProRestoreNotice("Logged in on this device.");
        setRestoreCode("");
        setRestoreStep("email");
        setShowLoginModal(false);
        setShowRewritePaywall(false);
        void refreshAccountSummary();
        return;
      }

      setHasProAccess(false);
      setEntitlementStatus("needs_restore");
      setProRestoreNotice("Logged in on this device.");
      setRestoreCode("");
      setRestoreStep("email");
      setShowLoginModal(false);
      setPaywallMode("upgrade");
      void refreshAccountSummary();
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_RESTORE_VERIFY_FAILED";
      if (code === "INVALID_CODE") {
        setRestoreError("Invalid or expired code. Please try again.");
        return;
      }
      if (code === "RATE_LIMITED") {
        setRestoreError("Too many attempts. Please wait and try again.");
        return;
      }
      if (code === "SERVICE_UNAVAILABLE") {
        setRestoreError("Restore is temporarily unavailable. Please try again shortly.");
        return;
      }

      setRestoreError("Unable to verify restore right now. Please try again.");
    } finally {
      setIsVerifyingRestore(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] px-4 py-10 md:py-14">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="relative mb-6 border-b border-slate-100 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image src="/rubricheck-logo.svg" alt="RubriCheck logo" width={135} height={36} className="h-9 w-auto" />
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  {ACTIVE_LANDING_COPY.headline}
                </h1>
                {SHOW_BETA_BADGE ? (
                  <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Beta
                  </span>
                ) : null}
              </div>
              <div className="inline-flex items-center gap-2">
                {SHOW_PRICING_BUTTON ? (
                  <Link
                    href="/pricing"
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      accountPlan === "pro"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:text-emerald-800"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {accountPlan === "pro" ? "Pro" : "Pricing"}
                  </Link>
                ) : null}
                {signedInEmail ? (
                  <div ref={accountMenuRef} className="relative">
                    <button
                      type="button"
                      title={signedInEmail}
                      aria-haspopup="menu"
                      aria-expanded={showAccountMenu}
                      onClick={() => setShowAccountMenu((previous) => !previous)}
                      className="inline-flex items-center gap-2 px-0.5 py-0.5 transition hover:opacity-90"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${getEmailInitialAvatarClassName(signedInEmail)}`}
                      >
                        {getEmailInitial(signedInEmail)}
                      </span>
                      {evaluationStatusChip ? (
                        <p
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${evaluationStatusChip.toneClassName}`}
                        >
                          {evaluationStatusChip.label}
                        </p>
                      ) : null}
                      <span className="sr-only">{signedInEmail}</span>
                    </button>
                    {showAccountMenu ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                      >
                        <p className="truncate px-2 py-1 text-xs text-slate-500">{signedInEmail}</p>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleLogout()}
                          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Log out
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openLoginModal}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Log in
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600 md:text-[15px]">
              {ACTIVE_LANDING_COPY.subtitle}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section
                className={`rounded-2xl border border-slate-200/90 bg-white p-4 transition md:p-5 ${
                  rubricMode === "file" && rubricDragOver
                    ? "-translate-y-px border-indigo-200 shadow-md ring-2 ring-indigo-100"
                    : "shadow-sm"
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
                className={`rounded-2xl border border-slate-200/90 bg-white p-4 transition md:p-5 ${
                  assignmentMode === "file" && assignmentDragOver
                    ? "-translate-y-px border-indigo-200 shadow-md ring-2 ring-indigo-100"
                    : "shadow-sm"
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

            {showRedisWarning ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                We&apos;re running in a temporary reliability mode while usage services reconnect.
              </div>
            ) : null}
            {errorCode === "OPENAI_TIMEOUT" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>{error}</p>
                {openAiTimeoutCount >= 2 ? (
                  <p className="mt-1 text-xs">Service is busy right now. Please wait a bit, then retry.</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void submitGrade(gradingMode)}
                  className="mt-3 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            ) : null}
            {errorCode === "FILE_PARSE_FAILED" ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p>{error}</p>
                <ul className="mt-2 list-disc pl-5 text-xs">
                  <li>Try again.</li>
                  <li>Upload another format (DOCX/TXT).</li>
                  <li>Switch to Paste Text.</li>
                  <li>If it&apos;s a scanned PDF, run OCR first.</li>
                </ul>
              </div>
            ) : null}
            {error && errorCode !== "OPENAI_TIMEOUT" && errorCode !== "FILE_PARSE_FAILED" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {lastRequestId ? <p className="mt-1 text-xs">Request ID: {lastRequestId}</p> : null}
              </div>
            ) : null}
            {draftRestoreNotice ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800">
                {draftRestoreNotice}
              </div>
            ) : null}

            <div className="flex items-stretch gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="min-w-0 flex-1 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-indigo-400 active:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Grade my assignment
              </button>
              <button
                type="button"
                onClick={handleStrictSubmit}
                disabled={isLoading}
                className="shrink-0 min-w-[9.25rem] rounded-xl border border-rose-300 bg-rose-50 px-5 py-2 text-xs font-semibold text-rose-700 transition-colors duration-150 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>🔥 Strict Mode</span>
              </button>
            </div>
            {isLoading ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600 md:text-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <span className="leading-5">{loadingMessage}</span>
              </div>
            ) : null}
          </form>
        </section>

        {showDailyLimitAlert ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close daily limit warning"
              onClick={() => setShowDailyLimitAlert(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="daily-limit-title"
              className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl"
            >
              <div className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                Warning
              </div>
              <h2 id="daily-limit-title" className="mt-3 text-lg font-semibold text-slate-900">
                Daily free limit reached
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                You used {dailyLimitValue ?? FREE_EVALUATIONS_PER_DAY} free evaluations today.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Check pricing options for Pro and one-time top-ups.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDailyLimitAlert(false)}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  Close
                </button>
                {SHOW_PRICING_BUTTON ? (
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Go to Pricing
                  </Link>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {gradeResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  ref={evaluationHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-slate-900 focus:outline-none"
                >
                  Evaluation Summary
                </h2>
                {resultMode === "strict" ? (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    🔥 Strict Mode
                  </span>
                ) : null}
              </div>
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

            {SHOW_PRO_FEATURES && !hasProAccess ? (
              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  {!signedInEmail ? (
                    <button
                      type="button"
                      onClick={openLoginModal}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-auto"
                    >
                      Log in
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openRewritePaywall("upgrade")}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-auto"
                  >
                    Upgrade to Pro
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-indigo-900/80 md:text-sm">
                  {signedInEmail
                    ? "You're logged in on this device. Upgrade to Pro to unlock rewrite/simulate."
                    : entitlementStatus === "needs_restore"
                      ? "Already subscribed? Log in with email verification, or upgrade to Pro."
                      : "Pro unlocks rewrite suggestions focused on improving your score."}
                </p>
                {proRestoreNotice ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700 md:text-sm">{proRestoreNotice}</p>
                ) : null}
              </div>
            ) : null}

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
                    const rationaleText = item.rationale ?? item.feedback;
                    const evidenceList = item.evidence ?? [];
                    const rewriteSuggestions =
                      hasProAccess && Array.isArray(item.example_revisions)
                        ? item.example_revisions
                            .map((revision) => revision.trim())
                            .filter((revision) => revision.length > 0)
                            .slice(0, 2)
                        : [];
                    const isDetailedBreakdownLocked = item.detailed_breakdown_locked === true;
                    const canShowDetailedBreakdown = SHOW_PRO_FEATURES && hasProAccess;
                    const detailedBreakdownBullets =
                      canShowDetailedBreakdown && item.detailed_breakdown
                        ? splitDetailedBreakdownBullets(item.detailed_breakdown)
                        : [];
                    const shouldForceHideDetailedBreakdown =
                      !canShowDetailedBreakdown && Boolean(item.detailed_breakdown);
                    const showDetailedBreakdownLockNotice =
                      SHOW_PRO_FEATURES &&
                      !hasProAccess &&
                      (isDetailedBreakdownLocked || shouldForceHideDetailedBreakdown);

                    return (
                      <Fragment key={criteriaKey}>
                        <tr>
                          <td className="px-4 py-3 align-top font-medium">{item.name}</td>
                          <td className="px-4 py-3 align-top">{item.max_score}</td>
                          <td className="px-4 py-3 align-top">
                            <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-sm font-medium text-indigo-700">
                              {formatEstimatedRangeDisplay(item.estimated_range, "-")}
                            </span>
                          </td>
                          <td className="max-w-[22rem] whitespace-normal break-words px-4 py-3 align-top">
                            <p>{rationaleText}</p>
                            {detailedBreakdownBullets.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                                {detailedBreakdownBullets.map((bullet, bulletIndex) => (
                                  <li key={`${criteriaKey}-detail-${bulletIndex}`}>{bullet}</li>
                                ))}
                              </ul>
                            ) : null}
                            {showDetailedBreakdownLockNotice ? (
                              <p className="mt-2 text-xs font-medium text-indigo-700">
                                {LOCKED_DETAILED_FEEDBACK_NOTICE}
                              </p>
                            ) : null}
                            {!isDetailedBreakdownLocked && evidenceList.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                                {evidenceList.map((snippet, snippetIndex) => (
                                  <li key={`${criteriaKey}-evidence-${snippetIndex}`}>{snippet}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                        </tr>
                        {SHOW_PRO_FEATURES ? (
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
                                      rewriteSuggestions.length > 0 ? (
                                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                                          {rewriteSuggestions.map((suggestion, suggestionIndex) => (
                                            <li key={`${criteriaKey}-rewrite-${suggestionIndex}`}>{suggestion}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-slate-600">
                                          Rewrite suggestions are not available for this criterion yet. Run Evaluate again to refresh this section.
                                        </p>
                                      )
                                    ) : (
                                      <>
                                        <p className="text-sm text-slate-600">
                                          Rewrite suggestions are a Pro feature to help you earn a better score. Log in or upgrade to unlock.
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {!signedInEmail ? (
                                            <button
                                              type="button"
                                              onClick={openLoginModal}
                                              className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                            >
                                              Log in
                                            </button>
                                          ) : null}
                                          <button
                                            type="button"
                                            onClick={() => openRewritePaywall("upgrade")}
                                            className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                          >
                                            Upgrade to Pro
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
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
                const rationaleText = item.rationale ?? item.feedback;
                const evidenceList = item.evidence ?? [];
                const rewriteSuggestions =
                  hasProAccess && Array.isArray(item.example_revisions)
                    ? item.example_revisions
                        .map((revision) => revision.trim())
                        .filter((revision) => revision.length > 0)
                        .slice(0, 2)
                    : [];
                const isDetailedBreakdownLocked = item.detailed_breakdown_locked === true;
                const canShowDetailedBreakdown = SHOW_PRO_FEATURES && hasProAccess;
                const detailedBreakdownBullets =
                  canShowDetailedBreakdown && item.detailed_breakdown
                    ? splitDetailedBreakdownBullets(item.detailed_breakdown)
                    : [];
                const shouldForceHideDetailedBreakdown =
                  !canShowDetailedBreakdown && Boolean(item.detailed_breakdown);
                const showDetailedBreakdownLockNotice =
                  SHOW_PRO_FEATURES &&
                  !hasProAccess &&
                  (isDetailedBreakdownLocked || shouldForceHideDetailedBreakdown);

                return (
                  <article
                    key={`${item.name}-mobile-${index}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                      <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-sm font-medium text-indigo-700">
                        {formatEstimatedRangeDisplay(item.estimated_range, "-")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Max score: {item.max_score}
                    </p>
                    <p className="mt-2 whitespace-normal break-words text-sm text-slate-700">
                      {rationaleText}
                    </p>
                    {detailedBreakdownBullets.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                        {detailedBreakdownBullets.map((bullet, bulletIndex) => (
                          <li key={`${criteriaKey}-mobile-detail-${bulletIndex}`}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {showDetailedBreakdownLockNotice ? (
                      <p className="mt-2 text-xs font-medium text-indigo-700">
                        {LOCKED_DETAILED_FEEDBACK_NOTICE}
                      </p>
                    ) : null}
                    {!isDetailedBreakdownLocked && evidenceList.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                        {evidenceList.map((snippet, snippetIndex) => (
                          <li key={`${criteriaKey}-mobile-evidence-${snippetIndex}`}>{snippet}</li>
                        ))}
                      </ul>
                    ) : null}

                    {SHOW_PRO_FEATURES ? (
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
                              rewriteSuggestions.length > 0 ? (
                                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                                  {rewriteSuggestions.map((suggestion, suggestionIndex) => (
                                    <li key={`${criteriaKey}-mobile-rewrite-${suggestionIndex}`}>{suggestion}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-600">
                                  Rewrite suggestions are not available for this criterion yet. Run Evaluate again to refresh this section.
                                </p>
                              )
                            ) : (
                              <>
                                <p className="text-sm text-slate-600">
                                  Rewrite suggestions are a Pro feature to help you earn a better score. Log in or upgrade to unlock.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {!signedInEmail ? (
                                    <button
                                      type="button"
                                      onClick={openLoginModal}
                                      className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                    >
                                      Log in
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => openRewritePaywall("upgrade")}
                                    className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                  >
                                    Upgrade to Pro
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {showLoginModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close login modal"
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="main-login-title"
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <h3 id="main-login-title" className="text-lg font-semibold text-slate-900">
                Log in
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                We will send a one-time code to verify ownership before logging you in.
              </p>
              <label htmlFor="main-restore-email" className="mt-4 block">
                <span className="text-xs font-semibold text-slate-700">Email</span>
                <input
                  id="main-restore-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={restoreEmail}
                  onChange={(event) => {
                    setRestoreEmail(event.target.value);
                    setRestoreError("");
                  }}
                  disabled={isStartingRestore || isVerifyingRestore}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
              {restoreStep === "code" ? (
                <label htmlFor="main-restore-code" className="mt-3 block">
                  <span className="text-xs font-semibold text-slate-700">Verification code</span>
                  <input
                    id="main-restore-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={restoreCode}
                    onChange={(event) => {
                      setRestoreCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setRestoreError("");
                    }}
                    disabled={isStartingRestore || isVerifyingRestore}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.2em] text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </label>
              ) : null}
              {restoreInfo ? (
                <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  {restoreInfo}
                </p>
              ) : null}
              {restoreError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {restoreError}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {restoreStep === "code" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRestoreStep("email");
                        setRestoreCode("");
                        setRestoreError("");
                        setRestoreInfo("");
                      }}
                      disabled={isStartingRestore || isVerifyingRestore}
                      className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVerifyRestorePro()}
                      disabled={isStartingRestore || isVerifyingRestore || !restoreCode.trim()}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isVerifyingRestore ? "Verifying..." : "Verify & Log in"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleStartRestorePro()}
                    disabled={isStartingRestore || isVerifyingRestore || !restoreEmail.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStartingRestore ? "Sending..." : "Send code"}
                  </button>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {SHOW_PRO_FEATURES && showRewritePaywall && !hasProAccess ? (
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
                Unlock Rewrite Suggestions
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Already subscribed? Log in. New to Pro? Upgrade with Stripe.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setPaywallMode("restore")}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                    paywallMode === "restore"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setPaywallMode("upgrade")}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                    paywallMode === "upgrade"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Upgrade to Pro
                </button>
              </div>

              {paywallMode === "restore" ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-600">
                    We will send a one-time code to verify ownership before logging you in.
                  </p>
                  <label htmlFor="restore-email" className="block">
                    <span className="text-xs font-semibold text-slate-700">Email</span>
                    <input
                      id="restore-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={restoreEmail}
                      onChange={(event) => {
                        setRestoreEmail(event.target.value);
                        setRestoreError("");
                      }}
                      disabled={isStartingRestore || isVerifyingRestore}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </label>
                  {restoreStep === "code" ? (
                    <label htmlFor="restore-code" className="block">
                      <span className="text-xs font-semibold text-slate-700">Verification code</span>
                      <input
                        id="restore-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="123456"
                        value={restoreCode}
                        onChange={(event) => {
                          setRestoreCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                          setRestoreError("");
                        }}
                        disabled={isStartingRestore || isVerifyingRestore}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.2em] text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  ) : null}
                  {restoreInfo ? (
                    <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                      {restoreInfo}
                    </p>
                  ) : null}
                  {restoreError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {restoreError}
                    </p>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {restoreStep === "code" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreStep("email");
                            setRestoreCode("");
                            setRestoreError("");
                            setRestoreInfo("");
                          }}
                          disabled={isStartingRestore || isVerifyingRestore}
                          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyRestorePro}
                          disabled={isStartingRestore || isVerifyingRestore || !restoreCode.trim()}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isVerifyingRestore ? "Verifying..." : "Verify & Log in"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartRestorePro}
                        disabled={isStartingRestore || isVerifyingRestore || !restoreEmail.trim()}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isStartingRestore ? "Sending..." : "Send code"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-600">
                    Choose a Pro billing plan, then continue to Stripe Checkout.
                  </p>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-slate-200 p-1.5">
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan("monthly")}
                      disabled={isCreatingCheckout}
                      className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                        checkoutPlan === "monthly"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan("annual")}
                      disabled={isCreatingCheckout}
                      className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                        checkoutPlan === "annual"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"
                      }`}
                    >
                      Annual
                    </button>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <p className="text-sm font-semibold text-indigo-900">
                      {selectedCheckoutPlanDisplay.price}
                      <span className="ml-1 text-xs font-medium text-indigo-700">
                        {selectedCheckoutPlanDisplay.periodLabel}
                      </span>
                    </p>
                    {selectedCheckoutPlanDisplay.saveNote ? (
                      <p className="mt-1 text-xs text-indigo-700">{selectedCheckoutPlanDisplay.saveNote}</p>
                    ) : null}
                  </div>
                  <label htmlFor="upgrade-email" className="block">
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
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {checkoutError}
                    </p>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleUpgradeToPro}
                      disabled={isCreatingCheckout || !checkoutEmail.trim()}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingCheckout
                        ? "Redirecting..."
                        : `Upgrade to Pro (${checkoutPlan === "annual" ? "Annual" : "Monthly"})`}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={closeRewritePaywall}
                  disabled={isCreatingCheckout || isStartingRestore || isVerifyingRestore}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <footer className="mt-10 px-1 py-2">
          <div className="flex flex-col gap-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <p>AI-generated estimate only. Not an official grade. RubriCheck.</p>
            <div className="flex flex-wrap items-center gap-3">
              {FOOTER_LEGAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-medium text-slate-600 transition hover:text-slate-900"
                >
                  {link.label}
                </a>
              ))}
              {feedbackUrl ? (
                <a
                  href={feedbackUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-slate-600 transition hover:text-slate-900"
                >
                  Feedback
                </a>
              ) : null}
            </div>
          </div>
        </footer>
        {showEnvDebugFooter ? (
          <footer className="pt-1 text-center text-[11px] text-slate-500">
            NEXT_PUBLIC_APP_ENV={NEXT_PUBLIC_APP_ENV || "(unset)"} | NODE_ENV={NODE_ENV || "(unset)"} |
            NEXT_PUBLIC_VERCEL_ENV={NEXT_PUBLIC_VERCEL_ENV || "(unset)"} | SHOW_PRO_FEATURES=
            {String(SHOW_PRO_FEATURES)}
          </footer>
        ) : null}
      </div>
    </main>
  );
}
