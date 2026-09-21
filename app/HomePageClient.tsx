"use client";


import {
  ChangeEvent,
  DragEvent,
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
import { useAccountSummary } from "./components/AccountSummaryProvider";
import { AccountStatusPill } from "./components/AccountStatusPill";
import { ProBadge } from "./components/ProBadge";
import { AssignmentSidebar, WorkspaceIcon } from "./components/AssignmentSidebar";
import { FeedbackButton } from "./components/FeedbackButton";
import { RubricLibrary, RubricDownloads } from "./components/RubricLibrary";
import type { SavedRubricDetail } from "../src/lib/rubricLibraryTypes";
import { generalRubric, ASSIGNMENT_INSTRUCTIONS_LIMIT } from "../lib/generalRubric";
import { GuestChoices, SampleExperience, GuestSummary } from "./components/GuestExperience";
import { isTrialPreview, type TrialPreview } from "../src/lib/trialPreview";
import { AssignmentProjectView } from "./components/AssignmentProjectView";
import { useAssignmentWorkspace } from "./components/useAssignmentWorkspace";
import { projectVersions, type AssignmentHistoryItem, type AssignmentProject } from "../src/lib/assignmentWorkspaceTypes";
import workspaceStyles from "./components/assignmentWorkspace.module.css";
import type { FinalEvaluation } from "../lib/gradeFinalization";
import { formatOverallScoreDisplay, explainScoreCalculation, SCORE_RANGE_NOTICE, SCORE_COMPARISON_NOTICE } from "../src/lib/scorePresentation";
import type { HiddenAiAlertSource } from "../lib/hiddenAiAlert";
import { isKnownAdminEmail } from "../src/config/admin";
import { ACTIVE_LANDING_COPY } from "../src/config/copy";
import { HOME_FAQ_ITEMS, HOME_INTERNAL_LINKS } from "../src/config/seoPages";
import {
  canAccessDetailedFeedback,
  canAccessRewriteSuggestions,
  canUseStrictMode,
  getVisibleTopImprovementsCount,
  type AccountFeatureTier,
} from "../src/lib/accountFeatureAccess";
import { DRAFT_KEY, parseDraft, saveDraftFiles, loadDraftFiles, type EvaluationDraft } from "../src/lib/evaluationDraft";
import { getEvaluateInterstitialDecision } from "../src/lib/evaluateInterstitial";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_FIELD_UPLOAD_BYTES = 30 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"];
const MULTI_UPLOAD_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const MAX_ADMIN_REAL_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

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

type StoredEvaluationResultSnapshot = {
  ownerEmail?: string;
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
  evaluation_id?: string;
  title: string;
  access_tier: AccountFeatureTier;
  overall_range: [number, number];
  score_calculation?: FinalEvaluation["score_calculation"];
  grading_basis?: FinalEvaluation["grading_basis"];
  summary: string;
  top_improvements: string[];
  criteria: CriteriaResult[];
  hidden_ai_alert?: {
    code: "HIDDEN_AI_TEXT";
    sources: HiddenAiAlertSource[];
    message: string;
  };
};

type EntitlementStatusResponse = {
  plan?: string;
  status?: string;
};

type CheckoutConfirmResponse = {
  ok?: boolean;
  status?: string;
  mode?: string;
  plan?: string;
  packId?: string;
  creditsAdded?: number;
  evaluationId?: string;
  code?: string;
  error?: string;
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

type RestoreStep = "email" | "code";
type ShareFeedbackState = "idle" | "copied" | "downloaded" | "failed";
type AuthVerificationPurpose = "login" | "restore";
type ComparisonImage = {
  name: string;
  src: string;
};

type ComparisonImagesResponse = {
  images?: ComparisonImage[];
};

const NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() ?? "development";
const NEXT_PUBLIC_VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim().toLowerCase() ?? "";
const NODE_ENV = process.env.NODE_ENV?.trim().toLowerCase() ?? "";
const SHOW_PRO_FEATURES = true;
const SHOW_ACCOUNT_AND_PRICING = true;

const FOOTER_LEGAL_LINKS = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Refund Policy", href: "/legal/refund-policy" },
  { label: "AI Disclaimer", href: "/legal/ai-disclaimer" },
  { label: "Data Retention", href: "/legal/data-retention" },
] as const;

const HOME_PRODUCT_HIGHLIGHTS = [
  {
    title: "Criterion-level feedback",
    description:
      "See how the draft lines up with individual rubric criteria instead of relying on a generic writing score.",
  },
  {
    title: "Score prediction ranges",
    description:
      "Use AI-estimated score ranges to understand likely outcomes before the official grade is given.",
  },
  {
    title: "Faster revision decisions",
    description:
      "Focus revision time on the feedback that matters most before a deadline, not on low-impact edits first.",
  },
] as const;

const HOME_PRODUCT_TAGS = ["For students", "Rubric-first", "Pre-submission"] as const;

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
const rubricFileInputId = "rubric-file-input";
const rubricCameraInputId = "rubric-camera-input";
const assignmentFileInputId = "assignment-file-input";
const assignmentCameraInputId = "assignment-camera-input";
const GRADING_MODE_STORAGE_KEY = "rubricheck_grading_mode";
const LOCKED_DETAILED_FEEDBACK_NOTICE = "Detailed feedback is locked. Buy credits or upgrade to Pro to unlock.";
const LOCKED_TOP_IMPROVEMENTS_NOTICE = "Buy credits or upgrade to Pro to unlock the remaining improvement priorities.";
const FREE_TRIAL_EVALUATIONS = 3;
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

function getCriterionPrimaryFeedbackText(item: CriteriaResult): string {
  const rationaleText = item.rationale?.trim();
  if (rationaleText) {
    return rationaleText;
  }

  return item.feedback.trim();
}

function getCriterionShareDetailBullets(item: CriteriaResult, accessTier: AccountFeatureTier): string[] {
  if (!item.detailed_breakdown) {
    return [];
  }

  const canShowDetailedBreakdown = SHOW_PRO_FEATURES && canAccessDetailedFeedback(accessTier);
  if (!canShowDetailedBreakdown) {
    return [];
  }

  return splitDetailedBreakdownBullets(item.detailed_breakdown).slice(0, 4);
}

function getVisibleTopImprovements(result: GradeResult): string[] {
  return result.top_improvements.slice(0, getVisibleTopImprovementsCount(result.access_tier));
}

function getLockedTopImprovementsCount(result: GradeResult): number {
  return Math.max(0, 3 - getVisibleTopImprovements(result).length);
}

function formatHiddenAiAlertSources(sources: HiddenAiAlertSource[]): string {
  if (sources.length === 2) {
    return "Rubric and assignment";
  }

  return sources[0] === "rubric" ? "Rubric" : "Assignment";
}

function formatEstimatedRangeDisplay(range: [number, number], separator: "~" | "-"): string {
  const [low, high] = range;
  if (low === high) {
    return String(low);
  }

  return `${low}${separator}${high}`;
}

function parseScoreValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

function calculateMatchPercentage(range: [number, number], realScore: number): number {
  const [low, high] = range;
  if (realScore >= low && realScore <= high) {
    return 100;
  }

  const distance = realScore < low ? low - realScore : realScore - high;
  return Math.max(0, Math.round(100 - distance));
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

function validateFiles(files: File[]): string | null {
  if (files.length === 0) {
    return "Please select at least one file.";
  }

  const hasUnsupportedType = files.some((file) => {
    const extension = getFileExtension(file.name);
    return !ACCEPTED_EXTENSIONS.includes(extension);
  });
  if (hasUnsupportedType) {
    return "Unsupported file type. Please upload PDF, DOCX, TXT, PNG, JPG, or JPEG.";
  }

  if (files.length > 1) {
    const allImages = files.every((file) => MULTI_UPLOAD_IMAGE_EXTENSIONS.has(getFileExtension(file.name)));
    if (!allImages) {
      return "Multiple files are supported for photos only. Upload one PDF/DOCX/TXT file or multiple images.";
    }
  }

  const hasOversizedFile = files.some((file) => file.size > MAX_FILE_SIZE_BYTES);
  if (hasOversizedFile) {
    return "File is too large. Max size is 10MB per file.";
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_FIELD_UPLOAD_BYTES) {
    return "Total upload is too large. Keep each section under 30MB.";
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

function removeCheckoutSessionIdFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has("checkout_session_id")) {
    return;
  }

  url.searchParams.delete("checkout_session_id");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
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
      aria-pressed={active}
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

function getWrappedTextHeight(lines: string[], lineHeight: number): number {
  return lines.length > 0 ? lines.length * lineHeight : 0;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  let cursorY = y;
  for (const line of lines) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }

  return cursorY;
}

function drawShareLogoMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const bars = [
    { yOffset: 0, width: 44, height: 8, radius: 4, color: "#f8fafc" },
    { yOffset: 14, width: 50, height: 7, radius: 3.5, color: "#cbd5e1" },
    { yOffset: 27, width: 36, height: 6, radius: 3, color: "#818cf8" },
  ];

  for (const bar of bars) {
    drawRoundedRect(ctx, x, y + bar.yOffset, bar.width, bar.height, bar.radius);
    ctx.fillStyle = bar.color;
    ctx.fill();
  }
}

function buildShareFallbackCanvas(result: GradeResult): HTMLCanvasElement {
  const width = 1320;
  const outerPadding = 40;
  const panelInset = 28;
  const gutter = 24;
  const leftColumnWidth = 350;
  const innerPanelWidth = width - (outerPadding + panelInset) * 2;
  const rightPanelWidth = innerPanelWidth - leftColumnWidth - gutter;
  const criteriaCardWidth = rightPanelWidth - 68;
  const criteriaTextWidth = criteriaCardWidth - 32;
  const scoreLineHeight = 92;
  const bodyLineHeight = 30;
  const detailLineHeight = 26;
  const sectionGap = 22;
  const leftBottomPadding = 40;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("CANVAS_CONTEXT_MISSING");
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const scoreText = formatOverallScoreDisplay(result.overall_range);
  const criteriaItems = result.criteria.slice(0, 4);
  const summaryWidth = leftColumnWidth - 64;

  ctx.font = "500 26px system-ui, -apple-system, Segoe UI, sans-serif";
  const summaryLines = wrapCanvasText(ctx, result.summary, summaryWidth);

  ctx.font = "500 24px system-ui, -apple-system, Segoe UI, sans-serif";
  const improvementLines = getVisibleTopImprovements(result).map((item) => wrapCanvasText(ctx, item, summaryWidth - 28));
  const lockedImprovementCount = getLockedTopImprovementsCount(result);
  const lockedImprovementsNote =
    lockedImprovementCount > 0
      ? wrapCanvasText(ctx, `${lockedImprovementCount} more improvement priorities are locked.`, summaryWidth - 8)
      : [];

  const criteriaCards = criteriaItems.map((item) => {
    ctx.font = "700 24px system-ui, -apple-system, Segoe UI, sans-serif";
    const estimatedRangeText = formatEstimatedRangeDisplay(item.estimated_range, "~");
    const titleText = `${item.name} (${estimatedRangeText} / ${item.max_score})`;
    const titleLines = wrapCanvasText(ctx, titleText, criteriaTextWidth);

    ctx.font = "400 21px system-ui, -apple-system, Segoe UI, sans-serif";
    const feedbackLines = wrapCanvasText(ctx, getCriterionPrimaryFeedbackText(item), criteriaTextWidth);
    ctx.font = "500 18px system-ui, -apple-system, Segoe UI, sans-serif";
    const detailLineGroups = getCriterionShareDetailBullets(item, result.access_tier).map((bullet) =>
      wrapCanvasText(ctx, `- ${bullet}`, criteriaTextWidth),
    );
    const detailHeight =
      detailLineGroups.length > 0
        ? detailLineGroups.reduce((sum, lines) => sum + getWrappedTextHeight(lines, 22), 0) + 12
        : 0;
    const height =
      26 +
      getWrappedTextHeight(titleLines, bodyLineHeight) +
      12 +
      getWrappedTextHeight(feedbackLines, detailLineHeight) +
      detailHeight +
      24;
    return { titleLines, feedbackLines, detailLineGroups, height };
  });

  const summaryHeight = getWrappedTextHeight(summaryLines, bodyLineHeight);
  const improvementsHeight = improvementLines.reduce(
    (total, lines) => total + Math.max(bodyLineHeight, getWrappedTextHeight(lines, detailLineHeight)) + 16,
    0,
  ) + (lockedImprovementsNote.length > 0 ? getWrappedTextHeight(lockedImprovementsNote, 22) + 18 : 0);
  const leftColumnHeight = 316 + summaryHeight + improvementsHeight + sectionGap * 2 + leftBottomPadding;
  const rightColumnHeight =
    124 + criteriaCards.reduce((total, card) => total + card.height, 0) + Math.max(0, criteriaCards.length - 1) * 16;
  const height = Math.max(760, outerPadding * 2 + Math.max(leftColumnHeight, rightColumnHeight));
  canvas.width = width;
  canvas.height = height;

  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#e0f2fe");
  bgGradient.addColorStop(0.48, "#f8fafc");
  bgGradient.addColorStop(1, "#fef3c7");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(14,165,233,0.10)";
  ctx.beginPath();
  ctx.arc(width - 120, 96, 132, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(250,204,21,0.14)";
  ctx.beginPath();
  ctx.arc(132, height - 118, 148, 0, Math.PI * 2);
  ctx.fill();

  drawRoundedRect(ctx, outerPadding, outerPadding, width - outerPadding * 2, height - outerPadding * 2, 34);
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const leftX = outerPadding + panelInset;
  const rightX = leftX + leftColumnWidth + gutter;
  const panelTop = outerPadding + panelInset;

  drawRoundedRect(ctx, leftX, panelTop, leftColumnWidth, height - outerPadding * 2 - 56, 28);
  ctx.fillStyle = "rgba(8,47,73,0.96)";
  ctx.fill();

  drawRoundedRect(ctx, rightX, panelTop, rightPanelWidth, height - outerPadding * 2 - 56, 28);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.22)";
  ctx.stroke();

  let leftCursorY = panelTop + 28;
  const leftTextX = leftX + 30;
  drawShareLogoMark(ctx, leftTextX, leftCursorY + 6);
  ctx.fillStyle = "rgba(248,250,252,0.96)";
  ctx.font = "700 24px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("RubriCheck", leftTextX + 62, leftCursorY + 22);
  ctx.textBaseline = "top";

  leftCursorY += 96;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 78px system-ui, -apple-system, Segoe UI, sans-serif";
  drawWrappedText(ctx, [scoreText], leftTextX, leftCursorY, scoreLineHeight);

  leftCursorY += 96;
  ctx.fillStyle = "rgba(224,242,254,0.78)";
  ctx.font = "600 18px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("AI estimate - not a calibrated confidence interval", leftTextX, leftCursorY);

  leftCursorY += 46;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Summary", leftTextX, leftCursorY);

  leftCursorY += 28;
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "500 26px system-ui, -apple-system, Segoe UI, sans-serif";
  leftCursorY = drawWrappedText(ctx, summaryLines, leftTextX, leftCursorY, bodyLineHeight);

  leftCursorY += sectionGap;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Top improvements", leftTextX, leftCursorY);

  leftCursorY += 28;
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "500 22px system-ui, -apple-system, Segoe UI, sans-serif";
  for (const lines of improvementLines) {
    if (lines.length === 0) {
      continue;
    }

    ctx.fillStyle = "#67e8f9";
    ctx.fillText("-", leftTextX, leftCursorY);
    ctx.fillStyle = "#e2e8f0";
    leftCursorY = drawWrappedText(ctx, lines, leftTextX + 20, leftCursorY, detailLineHeight) + 10;
  }

  if (lockedImprovementsNote.length > 0) {
    ctx.fillStyle = "rgba(226,232,240,0.72)";
    ctx.font = "500 18px system-ui, -apple-system, Segoe UI, sans-serif";
    leftCursorY += 4;
    leftCursorY = drawWrappedText(ctx, lockedImprovementsNote, leftTextX, leftCursorY, 22);
  }

  let rightCursorY = panelTop + 42;
  const rightTextX = rightX + 22;
  const criteriaCardX = rightTextX;

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Criteria", rightTextX, rightCursorY);

  rightCursorY += 16;
  ctx.fillStyle = "#475569";
  ctx.font = "500 17px system-ui, -apple-system, Segoe UI, sans-serif";
  rightCursorY = drawWrappedText(
    ctx,
    wrapCanvasText(ctx, "A compact summary designed for sharing before you revise and resubmit.", rightPanelWidth - 84),
    rightTextX,
    rightCursorY + 22,
    22,
  );

  rightCursorY += 18;
  for (const card of criteriaCards) {
    drawRoundedRect(ctx, criteriaCardX, rightCursorY, criteriaCardWidth, card.height, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(14,165,233,0.18)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    let cardCursorY = rightCursorY + 18;
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 24px system-ui, -apple-system, Segoe UI, sans-serif";
    cardCursorY = drawWrappedText(ctx, card.titleLines, criteriaCardX + 16, cardCursorY, bodyLineHeight);

    cardCursorY += 8;
    ctx.fillStyle = "#475569";
    ctx.font = "400 21px system-ui, -apple-system, Segoe UI, sans-serif";
    cardCursorY = drawWrappedText(ctx, card.feedbackLines, criteriaCardX + 16, cardCursorY, detailLineHeight);

    if (card.detailLineGroups.length > 0) {
      cardCursorY += 12;
      ctx.fillStyle = "#334155";
      ctx.font = "500 18px system-ui, -apple-system, Segoe UI, sans-serif";
      for (const lines of card.detailLineGroups) {
        cardCursorY = drawWrappedText(ctx, lines, criteriaCardX + 16, cardCursorY, 22) + 6;
      }
    }

    rightCursorY += card.height + 16;
  }

  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });

  if (blob) {
    return blob;
  }

  const dataUrl = canvas.toDataURL("image/png");
  const dataResponse = await fetch(dataUrl);
  return dataResponse.blob();
}

function downloadShareImage(blob: Blob): void {
  const pngUrl = URL.createObjectURL(blob);
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
}

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof navigator === "undefined" ||
    !navigator.clipboard?.write ||
    !("ClipboardItem" in window)
  ) {
    return false;
  }

  try {
    const clipboardItem = new window.ClipboardItem({
      [blob.type || "image/png"]: blob,
    });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch {
    return false;
  }
}

async function readImageFileAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || result.length === 0) {
        reject(new Error("IMAGE_READ_FAILED"));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

async function loadImageForCanvas(source: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    image.src = source;
  });
}

function drawImageContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export default function Home() {
  const evaluationAttemptRef = useRef<{ inputs: unknown[]; key: string } | null>(null);
  const rubricInputRef = useRef<HTMLInputElement | null>(null);
  const rubricCameraInputRef = useRef<HTMLInputElement | null>(null);
  const assignmentInputRef = useRef<HTMLInputElement | null>(null);
  const assignmentCameraInputRef = useRef<HTMLInputElement | null>(null);
  const evaluationHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const evaluationCaptureRef = useRef<HTMLElement | null>(null);
  const {
    signedInEmail,
    accountPlan,
    remainingEvaluations,
    hasLoadedAccountSummary,
    refreshAccountSummary,
    clearAccountSummary,
  } = useAccountSummary();

  const [rubricMode, setRubricMode] = useState<EvaluationDraft["rubricMode"]>("file");
  const [savedRubric, setSavedRubric] = useState<SavedRubricDetail | null>(null);
  const [showRubricLibrary, setShowRubricLibrary] = useState(false);
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const starterRef = useRef("");
  const [assignmentMode, setAssignmentMode] = useState<InputMode>("file");

  const [rubricFiles, setRubricFiles] = useState<File[]>([]);
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [rubricText, setRubricText] = useState("");
  const [assignmentText, setAssignmentText] = useState("");
  const [gradingMode, setGradingMode] = useState<GradingMode>("standard");
  const [resultMode, setResultMode] = useState<GradingMode | null>(null);

  const [rubricDragOver, setRubricDragOver] = useState(false);
  const [assignmentDragOver, setAssignmentDragOver] = useState(false);

  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [sampleSelected, setSampleSelected] = useState(false);
  const [trialPreview, setTrialPreview] = useState<TrialPreview | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [trialRestoreAttempt, setTrialRestoreAttempt] = useState(0);
  const trialPreviewRef = useRef<TrialPreview | null>(null);
  const evaluationInFlightRef = useRef(false);
  const [resultOwnerEmail, setResultOwnerEmail] = useState<string | null>(null);
  const [draftOwnerEmail, setDraftOwnerEmail] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"compose" | "project" | "result">("compose");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [openingAssignment, setOpeningAssignment] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const openRequestRef = useRef(0);
  const currentAccountRef = useRef(signedInEmail);
  currentAccountRef.current = signedInEmail;
  const workspace = useAssignmentWorkspace(signedInEmail, resultOwnerEmail === signedInEmail ? gradeResult?.evaluation_id : undefined);
  const activeProject = workspace.data.projects.find(project => project.id === activeProjectId);
  const activeAssignment = workspace.data.assignments.find(item => item.id === gradeResult?.evaluation_id);
  const workspaceBusy = loadingStep !== "idle" || openingAssignment;
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [openAiTimeoutCount, setOpenAiTimeoutCount] = useState(0);
  const [showRedisWarning, setShowRedisWarning] = useState(false);
  const [showDailyLimitAlert, setShowDailyLimitAlert] = useState(false);
  const [dailyLimitValue, setDailyLimitValue] = useState<number | null>(null);
  const [evaluationMessageIndex, setEvaluationMessageIndex] = useState(0);
  const [expandedRewriteSections, setExpandedRewriteSections] = useState<Record<string, boolean>>(
    {},
  );
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedbackState>("idle");
  const [comparisonImages, setComparisonImages] = useState<ComparisonImage[]>([]);
  const [isComparisonCollapsed, setIsComparisonCollapsed] = useState(false);
  const [selectedComparisonImage, setSelectedComparisonImage] = useState<ComparisonImage | null>(null);
  const [canScrollComparisonLeft, setCanScrollComparisonLeft] = useState(false);
  const [canScrollComparisonRight, setCanScrollComparisonRight] = useState(false);
  const [showAdminCombineModal, setShowAdminCombineModal] = useState(false);
  const [adminRealScoreInput, setAdminRealScoreInput] = useState("");
  const [adminRealScoreImageFile, setAdminRealScoreImageFile] = useState<File | null>(null);
  const [adminCombineError, setAdminCombineError] = useState("");
  const [isAdminCombining, setIsAdminCombining] = useState(false);
  const [hasProAccess, setHasProAccess] = useState(false);
  const [entitlementStatus, setEntitlementStatus] = useState<"active" | "needs_restore">("needs_restore");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showStrictModeUpgradeModal, setShowStrictModeUpgradeModal] = useState(false);
  const [restoreStep, setRestoreStep] = useState<RestoreStep>("email");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreInfo, setRestoreInfo] = useState("");
  const [isStartingRestore, setIsStartingRestore] = useState(false);
  const [isVerifyingRestore, setIsVerifyingRestore] = useState(false);
  const [loginModalPurpose, setLoginModalPurpose] = useState<AuthVerificationPurpose>("login");
  const canAccessAdmin = isKnownAdminEmail(signedInEmail);
  const canUseCurrentStrictMode = canUseStrictMode(accountPlan);
  const [proRestoreNotice, setProRestoreNotice] = useState("");
  const [showEnvDebugFooter, setShowEnvDebugFooter] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showBillingMenu, setShowBillingMenu] = useState(false);
  const [shouldFocusEvaluationHeading, setShouldFocusEvaluationHeading] = useState(false);
  const [draftRestoreNotice, setDraftRestoreNotice] = useState("");
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comparisonGalleryRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const billingMenuRef = useRef<HTMLDivElement | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [isResumingCheckout, setIsResumingCheckout] = useState(false);
  const draftFileKey = useRef("");
  const draftFilesSave = useRef<Promise<void>>(Promise.resolve());

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

  const refreshEntitlementStatus = useCallback(async () => {
    if (!SHOW_PRO_FEATURES) {
      setHasProAccess(false);
      setEntitlementStatus("needs_restore");
      return;
    }

    try {
      const response = await fetch("/api/entitlement", {
        method: "GET",
        cache: "no-store",
      });
      const data: EntitlementStatusResponse = await response.json().catch(() => ({}));
      const isActive = response.ok && data.plan === "pro" && data.status === "active";
      setHasProAccess(isActive);
      setEntitlementStatus(isActive ? "active" : "needs_restore");
    } catch {
      setHasProAccess(false);
      setEntitlementStatus("needs_restore");
    }
  }, []);

  function openLoginModal(infoMessage?: string) {
    setShowStrictModeUpgradeModal(false);
    setShowAccountMenu(false);
    setShowBillingMenu(false);
    setLoginModalPurpose("login");
    setRestoreStep("email");
    setRestoreCode("");
    setRestoreError("");
    setRestoreInfo(infoMessage ?? "");
    setShowLoginModal(true);
  }

  function ensureEvaluationAccess(selectedMode: GradingMode): boolean {

    if (!hasLoadedAccountSummary) {
      setError("Checking login status. Please try again.");
      setErrorCode("");
      return false;
    }

    if (!signedInEmail && selectedMode === "standard") {
      if (!resultReady) { setError("Checking preview availability. Please try again."); return false; }
      if (trialUsed) {
        openLoginModal("Your free preview has been used. Sign up for 3 free checks · No card required.");
        return false;
      }
      return true;
    }
    if (!signedInEmail) {
      setError("Log in before requesting an evaluation.");
      setErrorCode("AUTH_REQUIRED");
      maybeOpenLoginModal("Log in before requesting an evaluation.");
      return false;
    }

    return true;
  }

  function openOperationsLimitMessage(): string {
    if (SHOW_ACCOUNT_AND_PRICING) {
      return "Check pricing options for Pro and one-time top-ups.";
    }

    return "Free trial limit reached for this device.";
  }

  function shouldShowPricingCta(): boolean {
    return SHOW_ACCOUNT_AND_PRICING;
  }

  function shouldShowLoginModal(): boolean {
    return SHOW_ACCOUNT_AND_PRICING;
  }

  function canShowAccountActions(): boolean {
    return SHOW_ACCOUNT_AND_PRICING;
  }

  function maybeOpenLoginModal(infoMessage?: string) {
    if (!shouldShowLoginModal()) {
      return;
    }

    openLoginModal(infoMessage);
  }

  function openStrictModeUpgradeModal() {
    setShowLoginModal(false);
    setShowAccountMenu(false);
    setShowBillingMenu(false);
    setShowStrictModeUpgradeModal(true);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let storedMode: string | null = null;
    try { storedMode = window.localStorage.getItem(GRADING_MODE_STORAGE_KEY); } catch {}
    if (storedMode === "standard" || storedMode === "strict") {
      setGradingMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedAccountSummary) return;
    let active = true;
    setResultReady(false);
    setGradeResult(null);
    setResultMode(null);
    setActiveProjectId(null);
    setWorkspaceView("compose");
    setWorkspaceNotice("");
    openRequestRef.current++;
    setOpeningAssignment(false);
    setResultOwnerEmail(null);
    const restore = async () => {
      if (!signedInEmail) {
        setTrialPreview(null);
        trialPreviewRef.current = null;
        try {
          const response = await fetch("/api/trial", { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          if (!active) return;
          setTrialUsed(data.used === true);
          if (isTrialPreview(data.result)) {
            setTrialPreview(data.result);
            trialPreviewRef.current = data.result;
            try { window.sessionStorage.setItem("rubricheck_pending_trial", "1"); } catch {}
          }
        } catch { /* Submission will recheck availability on the server. */ }
        return;
      }
      let pendingTrial = Boolean(trialPreviewRef.current);
      try { pendingTrial ||= window.sessionStorage.getItem("rubricheck_pending_trial") === "1"; } catch {}
      if (pendingTrial) {
        try {
          const response = await fetch("/api/trial", { method: "POST" });
          const data = await response.json();
          if (!active) return;
          if (response.ok && isGradeResult(data.result, "standard")) {
            setGradeResult(data.result); setResultMode("standard"); setWorkspaceView("result");
            setTrialPreview(null); trialPreviewRef.current = null;
            try { window.sessionStorage.removeItem("rubricheck_pending_trial"); } catch {}
            const url = new URL(window.location.href);
            url.searchParams.set("evaluation_id", data.result.evaluation_id);
            window.history.replaceState({}, "", url.pathname + url.search);
            if (response.headers.get("x-history-unavailable") === "1") setWorkspaceNotice("Your feedback is ready, but could not be added to Recents. Try reopening it shortly.");
            return;
          }
          if (response.status === 404) {
            setTrialPreview(null); trialPreviewRef.current = null;
            try { window.sessionStorage.removeItem("rubricheck_pending_trial"); } catch {}
          }
          setWorkspaceNotice(data.message || "Could not open your preview. Please retry.");
        } catch { if (active) setWorkspaceNotice("Could not open your preview. Please retry."); }
      }
      try {
        const raw = window.sessionStorage.getItem(EVALUATION_RESULT_STORAGE_KEY) ?? window.localStorage.getItem(EVALUATION_RESULT_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<StoredEvaluationResultSnapshot>;
        if (!parsed.savedAt || Date.now() - parsed.savedAt > EVALUATION_RESULT_TTL_MS) return;
        if (parsed.ownerEmail && parsed.ownerEmail !== signedInEmail) return;
        let candidate = parsed.gradeResult;
        let mode = parsed.resultMode ?? "standard";
        // Legacy browser snapshots must be verified by the account-bound server.
        if (!parsed.ownerEmail) {
          if (!candidate?.evaluation_id) return;
          const response = await fetch("/api/evaluations/" + encodeURIComponent(candidate.evaluation_id), { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          candidate = data.result; mode = data.mode;
        }
        const params = new URLSearchParams(window.location.search);
        if (params.get("evaluation_id") && params.get("evaluation_id") !== candidate?.evaluation_id) return;
        if (active && isGradeResult(candidate, mode)) {
          setGradeResult(candidate);
          setResultMode(mode);
          if (params.get("evaluation_id") === candidate.evaluation_id && !params.has("checkout_session_id") && !params.has("checkout_canceled")) setWorkspaceView("result");
        }
      } catch { /* Storage may be unavailable in private browsing. */ }
    };
    void restore().finally(() => { if (active) { setResultOwnerEmail(signedInEmail); setResultReady(true); } });
    return () => { active = false; };
  }, [hasLoadedAccountSummary, signedInEmail, trialRestoreAttempt]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!resultReady || !signedInEmail || resultOwnerEmail !== signedInEmail) return;
    if (!gradeResult) {
      try {
        window.sessionStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
        window.localStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
      } catch {}
      return;
    }

    const snapshot: StoredEvaluationResultSnapshot = {
      ownerEmail: signedInEmail,
      gradeResult,
      resultMode,
      savedAt: Date.now(),
    };

    try {
      window.sessionStorage.setItem(EVALUATION_RESULT_STORAGE_KEY, JSON.stringify(snapshot));
      // Preserve existing result recovery after closing and reopening the browser.
      window.localStorage.setItem(EVALUATION_RESULT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota/private mode storage failures.
    }
  }, [gradeResult, resultMode, resultReady, signedInEmail, resultOwnerEmail]);

  useEffect(() => {
    if (!hasLoadedAccountSummary) return;
    setDraftReady(false);
    setShowRubricLibrary(false);
    setSavedRubric(null);
    setAssignmentInstructions("");
    let active = true;
    async function restoreDraft() {
      try {
        let key = window.sessionStorage.getItem("rubricheck_draft_files_key");
        if (!key) {
          key = crypto.randomUUID();
          window.sessionStorage.setItem("rubricheck_draft_files_key", key);
        }
        draftFileKey.current = key;
        const draft = parseDraft(window.sessionStorage.getItem(DRAFT_KEY) ?? window.localStorage.getItem(DRAFT_KEY));
        if (!draft) return;
        if (!active) return;
        if (draft.ownerEmail && draft.ownerEmail !== signedInEmail) {
          setRubricText(""); setAssignmentText(""); setRubricFiles([]); setAssignmentFiles([]);
          setRubricMode("file");
          setDraftProjectId(null); setDraftRestoreNotice("");
          return;
        }
        setDraftProjectId(draft.projectId ?? null);
        if (!new URLSearchParams(window.location.search).has("evaluation_id")) setActiveProjectId(draft.projectId ?? null);
        setRubricText(draft.rubricText);
        setAssignmentText(draft.assignmentText);
        setRubricMode(draft.rubricMode);
        setSavedRubric(draft.savedRubric ?? null);
        setAssignmentInstructions(typeof draft.assignmentInstructions === "string" ? draft.assignmentInstructions : "");
        setAssignmentMode(draft.assignmentMode);
        setGradingMode(draft.gradingMode);
        const files = await loadDraftFiles(key).catch(() => null);
        if (!active) return;
        setRubricFiles(files?.rubric ?? []);
        setAssignmentFiles(files?.assignment ?? []);
        const missing = (draft.hadRubricFile && !files?.rubric.length) || (draft.hadAssignmentFile && !files?.assignment.length);
        setDraftRestoreNotice(missing
          ? "Your text inputs were restored. Please re-select files that could not be saved."
          : "Your inputs were restored. You can continue where you left off.");
      } catch {
        // Keep the editor usable when browser storage is blocked.
      } finally {
        if (active) { setDraftOwnerEmail(signedInEmail); setDraftReady(true); }
      }
    }
    void restoreDraft();
    return () => { active = false; };
  }, [hasLoadedAccountSummary, signedInEmail]);

  useEffect(() => {
    if (!draftReady) return;
    const url = new URL(window.location.href);
    const start = url.searchParams.get("start");
    const entry = start + ":" + (signedInEmail || "guest");
    if (!start || starterRef.current === entry || url.searchParams.has("evaluation_id") || url.searchParams.has("checkout_session_id")) return;
    starterRef.current = entry;
    if (start === "general") { setRubricMode("general"); setSavedRubric(null); setSampleSelected(false); }
    if (start === "library") {
      if (signedInEmail) setShowRubricLibrary(true);
      else { setShowLoginModal(true); return; }
    }
    url.searchParams.delete("start");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    requestAnimationFrame(() => document.getElementById("rubric-checker")?.scrollIntoView({ block: "start" }));
  }, [draftReady, signedInEmail]);

  useEffect(() => {
    if (!draftReady || draftOwnerEmail !== signedInEmail) return;
    const snapshot: EvaluationDraft = {
      ownerEmail: signedInEmail, projectId: draftProjectId,
      rubricMode, savedRubric, assignmentInstructions, assignmentMode, rubricText, assignmentText, gradingMode,
      hadRubricFile: rubricFiles.length > 0, hadAssignmentFile: assignmentFiles.length > 0,
      savedAt: Date.now(),
    };
    const save = () => {
      try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot)); }
      catch { setDraftRestoreNotice("Browser storage is unavailable. Keep this page open to preserve your inputs."); }
    };
    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [draftReady, signedInEmail, draftOwnerEmail, draftProjectId, rubricMode, savedRubric, assignmentInstructions, assignmentMode, rubricText, assignmentText, gradingMode, rubricFiles.length, assignmentFiles.length]);

  useEffect(() => {
    if (!draftReady || !draftFileKey.current) return;
    draftFilesSave.current = draftFilesSave.current.catch(() => {}).then(() =>
      saveDraftFiles(draftFileKey.current, rubricFiles, assignmentFiles),
    );
    void draftFilesSave.current.catch(() => {
      setDraftRestoreNotice("Files could not be saved in this browser. Re-select them after returning.");
    });
  }, [draftReady, rubricFiles, assignmentFiles]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try { window.localStorage.setItem(GRADING_MODE_STORAGE_KEY, gradingMode); } catch {}
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
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("checkout_session_id")?.trim() ?? "";
    if (!sessionId || !draftReady || !resultReady) {
      return;
    }

    let cancelled = false;

    async function finalizeCheckoutReturn() {
      setIsResumingCheckout(true);
      setDraftRestoreNotice("Finalizing your purchase...");

      try {
        let lastData: CheckoutConfirmResponse = {};

        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = await fetch("/api/checkout/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionId }),
          });

          const data: CheckoutConfirmResponse = await response.json().catch(() => ({}));
          lastData = data;

          if (response.ok && data.ok === true) {
            await refreshAccountSummary();
            await refreshEntitlementStatus();
            if (cancelled) {
              return;
            }

            if (data.evaluationId) {
              setDraftRestoreNotice("Purchase confirmed. Preparing detailed feedback for your original assignment...");
              const upgrade = await fetch("/api/evaluations/upgrade", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
              });
              const detail = await upgrade.json();
              if (cancelled) return;
              if (upgrade.status === 410) {
                setDraftRestoreNotice("Purchase confirmed. The saved result has expired. Your restored inputs are available for a new evaluation.");
                removeCheckoutSessionIdFromUrl();
                return;
              }
              if (!upgrade.ok || !isGradeResult(detail.result, detail.mode ?? "standard")) {
                setDraftRestoreNotice("Purchase confirmed. Detailed feedback is still pending. Refresh to retry without another purchase or credit charge.");
                return;
              }
              setGradeResult(detail.result);
              setResultMode(detail.mode);
              setShouldFocusEvaluationHeading(true);
              setDraftRestoreNotice("Upgrade complete. Detailed feedback for your original assignment is ready.");
              removeCheckoutSessionIdFromUrl();
              return;
            }
            setDraftRestoreNotice(
              data.mode === "credits"
                ? data.creditsAdded && data.creditsAdded > 0
                  ? `Top-up applied. ${data.creditsAdded} evaluation credits were added to your account.`
                  : "Top-up is now available on this account."
                : "Pro is now active on this device.",
            );
            removeCheckoutSessionIdFromUrl();
            return;
          }

          if (!(response.ok && data.ok === false && data.status === "pending")) {
            throw new Error(data.code ?? data.error ?? "CHECKOUT_CONFIRM_FAILED");
          }

          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        if (cancelled) {
          return;
        }

        setDraftRestoreNotice(
          lastData.mode === "pro"
            ? "Your payment confirmation is still processing. Refresh in a moment to check Pro activation."
            : "Your payment confirmation is still processing. Refresh in a moment to check your top-up.",
        );
      } catch {
        if (cancelled) {
          return;
        }

        setDraftRestoreNotice("We could not confirm the purchase yet. Refresh to retry confirmation without starting another checkout.");
      } finally {
        if (!cancelled) setIsResumingCheckout(false);
      }
    }

    void finalizeCheckoutReturn();

    return () => {
      cancelled = true;
    };
  }, [refreshAccountSummary, refreshEntitlementStatus, draftReady, resultReady]);

  useEffect(() => {
    if (!resultReady || !hasLoadedAccountSummary || !signedInEmail) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("evaluation_id");
    if (!id || params.has("checkout_session_id")) return;
    let active = true;
    const navigation = openRequestRef.current;
    void fetch("/api/workspace/assignments/" + encodeURIComponent(id), { cache: "no-store" })
      .then(response => response.status === 404 ? fetch("/api/evaluations/" + encodeURIComponent(id), { cache: "no-store" }) : response)
      .then(async response => {
        const data = await response.json();
        if (!active || navigation !== openRequestRef.current) return;
        if (response.ok && isGradeResult(data.result, data.mode ?? "standard")) {
          setResultOwnerEmail(signedInEmail);
          setGradeResult(data.result);
          setResultMode(data.mode);
          if (!params.has("checkout_canceled")) setWorkspaceView("result");
        } else {
          setWorkspaceNotice(data.message || "Could not open this assignment.");
        }
      }).catch(() => { /* The browser snapshot remains available during an outage. */ });
    return () => { active = false; };
  }, [resultReady, hasLoadedAccountSummary, signedInEmail]);

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
    let cancelled = false;

    async function loadComparisonImages() {
      try {
        const response = await fetch("/api/comparison-images", {
          method: "GET",
          cache: "no-store",
        });
        const data: ComparisonImagesResponse = await response.json().catch(() => ({}));
        const images = Array.isArray(data.images)
          ? data.images.filter(
              (item) =>
                item &&
                typeof item === "object" &&
                typeof item.name === "string" &&
                typeof item.src === "string",
            )
          : [];

        if (cancelled) {
          return;
        }

        setComparisonImages(images);
      } catch {
        if (!cancelled) {
          setComparisonImages([]);
        }
      }
    }

    void loadComparisonImages();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateComparisonGalleryScrollState = useCallback(() => {
    const galleryElement = comparisonGalleryRef.current;
    if (!galleryElement || isComparisonCollapsed) {
      setCanScrollComparisonLeft(false);
      setCanScrollComparisonRight(false);
      return;
    }

    const maxScrollLeft = galleryElement.scrollWidth - galleryElement.clientWidth;
    setCanScrollComparisonLeft(galleryElement.scrollLeft > 2);
    setCanScrollComparisonRight(galleryElement.scrollLeft < maxScrollLeft - 2);
  }, [isComparisonCollapsed]);

  useEffect(() => {
    const refreshScrollState = () => {
      requestAnimationFrame(() => {
        updateComparisonGalleryScrollState();
      });
    };

    refreshScrollState();
    window.addEventListener("resize", refreshScrollState);
    return () => {
      window.removeEventListener("resize", refreshScrollState);
    };
  }, [comparisonImages.length, isComparisonCollapsed, updateComparisonGalleryScrollState]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showAccountMenu && !showBillingMenu) {
      return;
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node | null;
      if (
        !targetNode ||
        (!accountMenuRef.current?.contains(targetNode) && !billingMenuRef.current?.contains(targetNode))
      ) {
        setShowAccountMenu(false);
        setShowBillingMenu(false);
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
        setShowBillingMenu(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [showAccountMenu, showBillingMenu]);

  useEffect(() => {
    void refreshEntitlementStatus();
  }, [refreshEntitlementStatus]);

  async function goToPricingPage() {
    if (!draftReady) return;
    try {
      const snapshot: EvaluationDraft = {
        ownerEmail: signedInEmail, projectId: draftProjectId,
        rubricMode, savedRubric, assignmentInstructions, assignmentMode, rubricText, assignmentText, gradingMode,
        hadRubricFile: rubricFiles.length > 0, hadAssignmentFile: assignmentFiles.length > 0, savedAt: Date.now(),
      };
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
      await draftFilesSave.current.catch(() => {});
      if (rubricFiles.length || assignmentFiles.length) await saveDraftFiles(draftFileKey.current, rubricFiles, assignmentFiles);
    } catch {
      setDraftRestoreNotice("Your browser could not save these inputs. Keep this page open and open Pricing in a new tab.");
      return;
    }
    setShowLoginModal(false);
    setShowStrictModeUpgradeModal(false);
    setShowAccountMenu(false);
    setShowBillingMenu(false);
    const id = gradeResult?.evaluation_id;
    window.location.assign(id ? "/pricing?evaluation_id=" + encodeURIComponent(id) : "/pricing");
  }

  function toggleRewriteSection(criteriaKey: string) {
    setExpandedRewriteSections((previous) => ({
      ...previous,
      [criteriaKey]: !previous[criteriaKey],
    }));
  }

  function setShareFeedbackWithReset(nextState: ShareFeedbackState, durationMs = 2200) {
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }

    setShareFeedback(nextState);

    if (nextState === "idle") {
      return;
    }

    copyResetTimerRef.current = setTimeout(() => {
      setShareFeedback("idle");
    }, durationMs);
  }

  function handleScrollComparisonGallery(direction: "left" | "right") {
    const galleryElement = comparisonGalleryRef.current;
    if (!galleryElement) {
      return;
    }

    const scrollAmount = Math.max(260, Math.floor(galleryElement.clientWidth * 0.72));
    const delta = direction === "left" ? -scrollAmount : scrollAmount;
    galleryElement.scrollBy({ left: delta, behavior: "smooth" });
  }

  function openAdminCombineModal() {
    if (!canAccessAdmin || !gradeResult) {
      return;
    }

    setAdminCombineError("");
    setAdminRealScoreInput("");
    setAdminRealScoreImageFile(null);
    setShowAdminCombineModal(true);
  }

  function closeAdminCombineModal() {
    if (isAdminCombining) {
      return;
    }

    setShowAdminCombineModal(false);
    setAdminCombineError("");
    setAdminRealScoreInput("");
    setAdminRealScoreImageFile(null);
  }

  function handleAdminRealImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setAdminCombineError("");
    setAdminRealScoreImageFile(file);
  }

  async function captureEvaluationAreaDataUrl(): Promise<string> {
    if (!gradeResult) {
      throw new Error("GRADE_RESULT_MISSING");
    }

    if (!evaluationCaptureRef.current) {
      const fallbackCanvas = buildShareFallbackCanvas(gradeResult);
      return fallbackCanvas.toDataURL("image/png");
    }

    try {
      const { default: html2canvas } = await import("html2canvas");
      const capturedCanvas = await html2canvas(evaluationCaptureRef.current, {
        backgroundColor: "#ffffff",
        scale: Math.min(1.5, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
      });

      const capturedDataUrl = capturedCanvas.toDataURL("image/png");
      if (capturedDataUrl.startsWith("data:image/png")) {
        return capturedDataUrl;
      }
    } catch {
      // Fallback rendering below.
    }

    const fallbackCanvas = buildShareFallbackCanvas(gradeResult);
    return fallbackCanvas.toDataURL("image/png");
  }

  async function buildAdminCombinedImageDataUrl(
    rubricImageSrc: string,
    realImageSrc: string,
    rubricScoreLabel: string,
    realScoreLabel: string,
    matchPercentage: number,
  ): Promise<string> {
    const [rubricImage, realImage] = await Promise.all([
      loadImageForCanvas(rubricImageSrc),
      loadImageForCanvas(realImageSrc),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("COMBINED_CANVAS_CONTEXT_MISSING");
    }

    const outerPadding = 44;
    const cardGap = 28;
    const headerHeight = 170;
    const cardWidth = (canvas.width - outerPadding * 2 - cardGap) / 2;
    const cardHeight = canvas.height - outerPadding * 2 - headerHeight;
    const leftCardX = outerPadding;
    const rightCardX = outerPadding + cardWidth + cardGap;
    const cardY = outerPadding + headerHeight;

    const backgroundGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    backgroundGradient.addColorStop(0, "#eef2ff");
    backgroundGradient.addColorStop(1, "#f8fafc");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.textBaseline = "top";
    context.textAlign = "center";
    context.fillStyle = "#1e293b";
    context.font = "800 84px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText(`${matchPercentage}%`, canvas.width / 2, 36);
    context.fillStyle = "#475569";
    context.font = "700 30px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("MATCH", canvas.width / 2, 124);
    context.textAlign = "left";

    drawRoundedRect(context, leftCardX, cardY, cardWidth, cardHeight, 24);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 2;
    context.stroke();

    drawRoundedRect(context, rightCardX, cardY, cardWidth, cardHeight, 24);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = "#334155";
    context.font = "700 26px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("RubriCheck", leftCardX + 24, cardY + 20);
    context.fillStyle = "#4338ca";
    context.font = "700 34px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText(`${rubricScoreLabel} / 100`, leftCardX + 24, cardY + 58);

    context.fillStyle = "#334155";
    context.font = "700 26px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText("Real", rightCardX + 24, cardY + 20);
    context.fillStyle = "#0f766e";
    context.font = "700 34px system-ui, -apple-system, Segoe UI, sans-serif";
    context.fillText(`${realScoreLabel} / 100`, rightCardX + 24, cardY + 58);

    const imageInset = 20;
    const imageTopOffset = 118;
    const imageBoxHeight = cardHeight - imageTopOffset - imageInset;
    drawRoundedRect(
      context,
      leftCardX + imageInset,
      cardY + imageTopOffset,
      cardWidth - imageInset * 2,
      imageBoxHeight,
      16,
    );
    context.fillStyle = "#f8fafc";
    context.fill();

    drawRoundedRect(
      context,
      rightCardX + imageInset,
      cardY + imageTopOffset,
      cardWidth - imageInset * 2,
      imageBoxHeight,
      16,
    );
    context.fillStyle = "#f8fafc";
    context.fill();

    drawImageContained(
      context,
      rubricImage,
      leftCardX + imageInset + 10,
      cardY + imageTopOffset + 10,
      cardWidth - imageInset * 2 - 20,
      imageBoxHeight - 20,
    );
    drawImageContained(
      context,
      realImage,
      rightCardX + imageInset + 10,
      cardY + imageTopOffset + 10,
      cardWidth - imageInset * 2 - 20,
      imageBoxHeight - 20,
    );

    return canvas.toDataURL("image/png");
  }

  async function handleAdminCombineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAccessAdmin) {
      return;
    }

    if (!gradeResult) {
      setAdminCombineError("Run grading first.");
      return;
    }

    const parsedRealScore = parseScoreValue(adminRealScoreInput);
    if (parsedRealScore === null) {
      setAdminCombineError("Enter a real score between 0 and 100.");
      return;
    }

    if (!adminRealScoreImageFile) {
      setAdminCombineError("Upload a real score image.");
      return;
    }

    if (!adminRealScoreImageFile.type.startsWith("image/")) {
      setAdminCombineError("Only image files are supported.");
      return;
    }

    if (adminRealScoreImageFile.size > MAX_ADMIN_REAL_IMAGE_SIZE_BYTES) {
      setAdminCombineError("Real image must be 8MB or smaller.");
      return;
    }

    setIsAdminCombining(true);
    setAdminCombineError("");

    try {
      const evaluationImageSrc = await captureEvaluationAreaDataUrl();
      const realImageSrc = await readImageFileAsDataUrl(adminRealScoreImageFile);
      const matchPercentage = calculateMatchPercentage(gradeResult.overall_range, parsedRealScore);
      const combinedImageSrc = await buildAdminCombinedImageDataUrl(
        evaluationImageSrc,
        realImageSrc,
        formatOverallScoreDisplay(gradeResult.overall_range),
        String(parsedRealScore),
        matchPercentage,
      );

      const createdImage: ComparisonImage = {
        name: `combined-${Date.now()}.png`,
        src: combinedImageSrc,
      };
      setComparisonImages((previous) => [createdImage, ...previous]);
      setSelectedComparisonImage(createdImage);
      setShowAdminCombineModal(false);
      setAdminRealScoreInput("");
      setAdminRealScoreImageFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "COMBINE_FAILED";
      if (message === "IMAGE_READ_FAILED" || message === "IMAGE_LOAD_FAILED") {
        setAdminCombineError("Real image format is not supported. Use PNG, JPG, WEBP, or GIF.");
      } else if (message === "COMBINED_CANVAS_CONTEXT_MISSING") {
        setAdminCombineError("Your browser could not create a canvas image. Please retry.");
      } else {
        setAdminCombineError("Could not create a combined image. Please try again.");
      }
    } finally {
      setIsAdminCombining(false);
    }
  }

  async function handleShareResultsImage() {
    if (!gradeResult) {
      return;
    }

    setIsSharingImage(true);
    setShareFeedbackWithReset("idle");

    try {
      const canvas = buildShareFallbackCanvas(gradeResult);
      const imageBlob = await canvasToBlob(canvas);
      if (!imageBlob || imageBlob.size === 0) {
        throw new Error("IMAGE_BLOB_EMPTY");
      }

      const copied = await copyImageToClipboard(imageBlob);
      if (copied) {
        setShareFeedbackWithReset("copied", 2800);
        return;
      }

      downloadShareImage(imageBlob);
      setShareFeedbackWithReset("downloaded", 3200);
    } catch {
      setShareFeedbackWithReset("failed", 2800);
    } finally {
      setIsSharingImage(false);
    }
  }

  function clearFile(field: InputField, inputRef?: RefObject<HTMLInputElement | null>) {
    if (field === "rubric") {
      setRubricFiles([]);
    } else {
      setAssignmentFiles([]);
    }

    if (inputRef?.current) {
      inputRef.current.value = "";
      return;
    }

    if (field === "rubric") {
      if (rubricInputRef.current) {
        rubricInputRef.current.value = "";
      }
      if (rubricCameraInputRef.current) {
        rubricCameraInputRef.current.value = "";
      }
      return;
    }

    if (assignmentInputRef.current) {
      assignmentInputRef.current.value = "";
    }
    if (assignmentCameraInputRef.current) {
      assignmentCameraInputRef.current.value = "";
    }
  }

  function switchRubricMode(nextMode: EvaluationDraft["rubricMode"]) {
    setSavedRubric(null);
    setRubricMode(nextMode);
    setError("");

    if (nextMode === "text" || nextMode === "general") {
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

  function applyFileSelection(field: InputField, selectedFiles: File[], mode: "replace" | "append" = "replace") {
    const existingFiles = field === "rubric" ? rubricFiles : assignmentFiles;
    const nextFiles = mode === "append" ? [...existingFiles, ...selectedFiles] : selectedFiles;
    const validationError = validateFiles(nextFiles);
    if (validationError) {
      setError(validationError);
      clearFile(field);
      return;
    }

    setError("");
    if (field === "rubric") {
      setRubricFiles(nextFiles);
    } else {
      setAssignmentFiles(nextFiles);
    }
  }

  function handleFileInputChange(
    field: InputField,
    event: ChangeEvent<HTMLInputElement>,
    mode: "replace" | "append" = "replace",
  ) {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length === 0) {
      restoreBrowserFocus();
      return;
    }

    applyFileSelection(field, selectedFiles, mode);
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

    applyFileSelection(field, Array.from(files));
  }

  function mapApiError(data: GradeErrorResponse): string {
    const message = data.code ?? data.error;

    if (message === "TRIAL_PENDING" || message === "TRIAL_INPUT_TOO_LONG" || message === "TRIAL_UNAVAILABLE") {
      return data.message || "The preview is temporarily unavailable. Please retry shortly.";
    }

    if (message === "EVALUATION_PENDING") {
      return "Your evaluation is still running. Please wait a moment and retry.";
    }
    if (message === "EVALUATION_ALREADY_COMPLETED") {
      return "This evaluation already completed and was only counted once. Check your saved result, or submit again to start a new evaluation.";
    }
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
      return `Text extraction failed for ${target}. Try a clearer photo, upload another format, or paste text.`;
    }

    if (message === "OCR_UNAVAILABLE") {
      return "Image OCR is temporarily unavailable. Please retry or paste text directly.";
    }

    if (message === "UNSUPPORTED_FILE_TYPE") {
      return "Unsupported file type. Please upload PDF, DOCX, TXT, PNG, JPG, or JPEG.";
    }

    if (message === "FILE_TOO_LARGE") {
      return "File is too large. Max size is 10MB per file.";
    }

    if (message === "FILE_TOTAL_TOO_LARGE") {
      return "Total upload is too large. Keep each section under 30MB.";
    }

    if (message === "MULTI_FILE_IMAGES_ONLY") {
      return "Multiple files are supported for photos only. Upload one PDF/DOCX/TXT file or multiple images.";
    }

    if (message === "RUBRIC_NOT_FOUND") {
      return "This saved rubric is no longer available. Choose another rubric from My rubrics.";
    }

    if (message === "RUBRIC_LIBRARY_UNAVAILABLE") {
      return "Could not open your saved rubric. Please try again.";
    }

    if (message === "INVALID_MODE") {
      return "Invalid grading mode. Please select Standard or Strict Mode.";
    }

    if (message === "INVALID_JSON" || message === "INVALID_INPUT") {
      return "Please provide valid rubric and assignment inputs.";
    }

    if (message === "FREE_LIMIT_REACHED") {
      return "You've used the 3 free trial evaluations for this account. Upgrade to Pro or buy credits to continue.";
    }

    return "Something went wrong. Please try again.";
  }

  function isGradeResult(value: unknown, mode: GradingMode): value is GradeResult {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<GradeResult>;

    const hasTitle = typeof candidate.title === "string";
    const hasAccessTier =
      candidate.access_tier === "free" || candidate.access_tier === "topup" || candidate.access_tier === "pro";
    const hasSummary = typeof candidate.summary === "string";
    const hasOverallRange =
      Array.isArray(candidate.overall_range) &&
      candidate.overall_range.length === 2 &&
      candidate.overall_range.every((item) => typeof item === "number");
    const hasTopImprovements =
      Array.isArray(candidate.top_improvements) &&
      (candidate.top_improvements.length === 3 ||
        (candidate.access_tier === "free" && candidate.top_improvements.length === 1)) &&
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
    const hasValidHiddenAiAlert =
      candidate.hidden_ai_alert === undefined ||
      (candidate.hidden_ai_alert !== null &&
        typeof candidate.hidden_ai_alert === "object" &&
        candidate.hidden_ai_alert.code === "HIDDEN_AI_TEXT" &&
        Array.isArray(candidate.hidden_ai_alert.sources) &&
        candidate.hidden_ai_alert.sources.length >= 1 &&
        candidate.hidden_ai_alert.sources.length <= 2 &&
        candidate.hidden_ai_alert.sources.every(
          (source) => source === "rubric" || source === "assignment",
        ) &&
        typeof candidate.hidden_ai_alert.message === "string");

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

    return (
      hasTitle &&
      hasAccessTier &&
      hasSummary &&
      hasOverallRange &&
      hasTopImprovements &&
      hasCriteria &&
      hasValidHiddenAiAlert &&
      hasStrictEvidence
    );
  }

  async function submitGrade(selectedMode: GradingMode) {
    if (evaluationInFlightRef.current) return;
    if (isLoading || !draftReady || isResumingCheckout) {
      return;
    }

    if (selectedMode === "strict" && !canUseCurrentStrictMode) {
      openStrictModeUpgradeModal();
      return;
    }

    if (!ensureEvaluationAccess(selectedMode)) {
      return;
    }

    setGradingMode(selectedMode);
    setError("");
    setErrorCode("");
    setShowRedisWarning(false);
    setShowDailyLimitAlert(false);
    setDraftRestoreNotice("");
    setDailyLimitValue(null);
    setShouldFocusEvaluationHeading(false);
    setGradeResult(null);
    setResultMode(null);
    setExpandedRewriteSections({});
    setIsSharingImage(false);
    setShareFeedback("idle");
    setSelectedComparisonImage(null);
    setShowAdminCombineModal(false);
    setAdminRealScoreInput("");
    setAdminRealScoreImageFile(null);
    setAdminCombineError("");
    setIsAdminCombining(false);

    const stepTimers: Array<ReturnType<typeof setTimeout>> = [];

    const rubricProvided = rubricMode === "general" || (rubricMode === "library" ? Boolean(savedRubric) : rubricMode === "file" ? rubricFiles.length > 0 : rubricText.trim().length > 0);
    const assignmentProvided =
      assignmentMode === "file" ? assignmentFiles.length > 0 : assignmentText.trim().length > 0;

    if (!rubricProvided || !assignmentProvided) {
      setError(rubricMode === "general" ? "Please provide an assignment." : "Please provide both a rubric and an assignment.");
      return;
    }

    if (rubricMode === "file") {
      const rubricValidationError = validateFiles(rubricFiles);
      if (rubricValidationError) {
        setError(rubricValidationError);
        return;
      }
    }

    if (assignmentMode === "file") {
      const assignmentValidationError = validateFiles(assignmentFiles);
      if (assignmentValidationError) {
        setError(assignmentValidationError);
        return;
      }
    }

    evaluationInFlightRef.current = true;
    const startedAt = performance.now();
    const startedAtIso = new Date().toISOString();

    try {
      setLoadingStep("uploading");
      // Preserve the key after failures; changed inputs or a completed result start a new attempt.
      const inputs = [draftProjectId, selectedMode, rubricMode, savedRubric?.id, assignmentInstructions.trim(), assignmentMode, rubricText.trim(), assignmentText.trim(), ...rubricFiles, ...assignmentFiles];
      const previous = evaluationAttemptRef.current;
      if (!previous || previous.inputs.length !== inputs.length || inputs.some((value, index) => value !== previous.inputs[index])) {
        evaluationAttemptRef.current = { inputs, key: crypto.randomUUID() };
      }
      const attemptKey = evaluationAttemptRef.current!.key;
      let requestPromise: Promise<Response>;

      if (rubricMode !== "file" && assignmentMode === "text") {
        requestPromise = fetch("/api/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": attemptKey,
            ...(draftProjectId ? { "x-project-id": draftProjectId } : {}),
          },
          body: JSON.stringify({
            rubricSource: rubricMode === "general" ? "general" : rubricMode === "library" ? "saved" : "provided",
            ...(rubricMode === "text" ? { rubricText: rubricText.trim() } : {}),
            ...(rubricMode === "library" ? { rubricId: savedRubric?.id } : {}),
            ...(rubricMode === "general" ? { assignmentInstructions: assignmentInstructions.trim() } : {}),
            assignmentText: assignmentText.trim(),
            mode: selectedMode,
          }),
        });
      } else {
        const formData = new FormData();
        formData.set("rubricSource", rubricMode === "general" ? "general" : rubricMode === "library" ? "saved" : "provided");
        if (rubricMode === "library" && savedRubric) formData.set("rubricId", savedRubric.id);
        if (rubricMode === "general") formData.set("assignmentInstructions", assignmentInstructions.trim());

        if (rubricMode === "file") {
          if (rubricFiles.length === 0) {
            setError("Please provide both a rubric and an assignment.");
            return;
          }
          for (const file of rubricFiles) {
            formData.append("rubric", file);
          }
        } else if (rubricMode === "text") {
          formData.append("rubricText", rubricText.trim());
        }

        if (assignmentMode === "file") {
          if (assignmentFiles.length === 0) {
            setError("Please provide both a rubric and an assignment.");
            return;
          }
          for (const file of assignmentFiles) {
            formData.append("assignment", file);
          }
        } else {
          formData.append("assignmentText", assignmentText.trim());
        }

        formData.append("mode", selectedMode);

        requestPromise = fetch("/api/evaluate", {
          method: "POST",
          body: formData,
          headers: { "Idempotency-Key": attemptKey, ...(draftProjectId ? { "x-project-id": draftProjectId } : {}) },
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
      await refreshAccountSummary();

      const apiErrorResponse = (data ?? {}) as GradeErrorResponse;
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
      if ((apiCode || apiError) === "TRIAL_LIMIT_REACHED") {
        setTrialUsed(true);
        setTrialRestoreAttempt(value => value + 1);
        openLoginModal("Your free preview has been used. Sign up for 3 free checks · No card required.");
        return;
      }
      if ((apiCode || apiError) === "SIGN_IN_REQUIRED" || (apiCode || apiError) === "AUTH_REQUIRED") {
        openLoginModal("Log in to grade your assignment.");
        setError("");
        setErrorCode("");
        return;
      }
      const limitHeaderRaw = response.headers.get("x-ratelimit-limit");
      const limitFromHeader = limitHeaderRaw ? Number.parseInt(limitHeaderRaw, 10) : Number.NaN;
      const limitFromErrorMatch = (apiMessage || apiError).match(/Free(?: trial)? limit reached \((\d+)\)/i);
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
        fallbackLimit: detectedDailyLimit ?? FREE_TRIAL_EVALUATIONS,
      });

      if (interstitialDecision.show) {
        setDailyLimitValue(interstitialDecision.freeLimit ?? FREE_TRIAL_EVALUATIONS);
        setShowDailyLimitAlert(true);
        setError("");
        return;
      }

      if (!response.ok) {
        if ((apiCode || apiError) === "EVALUATION_ALREADY_COMPLETED") evaluationAttemptRef.current = null;
        setError(mapApiError((data ?? {}) as GradeErrorResponse));
        setErrorCode(apiCode || apiError);
        if ((apiCode || apiError) === "OPENAI_TIMEOUT") {
          setOpenAiTimeoutCount((prev) => prev + 1);
        } else {
          setOpenAiTimeoutCount(0);
        }
        return;
      }

      setOpenAiTimeoutCount(0);

      if (isTrialPreview(data)) {
        setTrialPreview(data); trialPreviewRef.current = data; setTrialUsed(true);
        setSampleSelected(false);
        try { window.sessionStorage.setItem("rubricheck_pending_trial", "1"); } catch {}
        evaluationAttemptRef.current = null;
        requestAnimationFrame(() => {
          const heading = document.getElementById("guest-evaluation-summary");
          heading?.scrollIntoView({ behavior: "smooth", block: "center" }); heading?.focus({ preventScroll: true });
        });
        return;
      }

      if (!isGradeResult(data, selectedMode)) {
        setError("Something went wrong. Please try again.");
        return;
      }

      evaluationAttemptRef.current = null;
      setShouldFocusEvaluationHeading(true);
      setResultOwnerEmail(signedInEmail);
      setGradeResult(data);
      setResultMode(selectedMode);
      if (response.headers.get("x-history-unavailable") === "1") {
        setWorkspaceNotice("Your result is ready, but could not be added to Recents. Keep this page open and try again.");
      }
      if (response.headers.get("x-recovery-unavailable") === "1") {
        setDraftRestoreNotice("Your result is ready, but server recovery is temporarily unavailable. Keep your inputs for a later evaluation.");
      }
      if (response.headers.get("x-rubric-library-unavailable") === "1") {
        setDraftRestoreNotice("Your result is ready, but the rubric could not be saved to My rubrics. Keep your original rubric for reuse.");
      }
      const elapsedMs = performance.now() - startedAt;
      const requestId = response.headers.get("x-request-id") ?? "unknown";
      requestAnimationFrame(() => {
        console.log(
          `[RubriCheck][GradeTiming] mode=${selectedMode} totalMs=${elapsedMs.toFixed(1)} requestId=${requestId} startedAt=${startedAtIso}`,
        );
      });
    } catch (error) {
      console.error("EVALUATION_REQUEST_FAILED", error);
      setError("Something went wrong. Please try again.");
    } finally {
      evaluationInFlightRef.current = false;
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
    if (!canUseCurrentStrictMode) {
      openStrictModeUpgradeModal();
      return;
    }

    if (!ensureEvaluationAccess("strict")) {
      return;
    }
    void submitGrade("strict");
  }

  async function handleLogout() {
    evaluationAttemptRef.current = null;
    setShowAccountMenu(false);
    setShowBillingMenu(false);

    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      // Ignore network/logout failures and reset local session state.
    }

    clearAccountSummary();
    setHasProAccess(false);
    setEntitlementStatus("needs_restore");
    setProRestoreNotice("");
    setShowLoginModal(false);
    setRestoreStep("email");
    setRestoreCode("");
    setRestoreError("");
    setRestoreInfo("");
    setGradeResult(null);
    setResultMode(null);
    setActiveProjectId(null);
    setWorkspaceView("compose");
    setWorkspaceNotice("");
    openRequestRef.current++;
    setSelectedComparisonImage(null);
    setShowAdminCombineModal(false);
    setAdminRealScoreInput("");
    setAdminRealScoreImageFile(null);
    setAdminCombineError("");
    setIsAdminCombining(false);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
        window.localStorage.removeItem(EVALUATION_RESULT_STORAGE_KEY);
      } catch {}
      updateWorkspaceUrl(null);
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
      if (code === "OTP_EMAIL_PROVIDER_NOT_CONFIGURED") {
        setRestoreError("Restore email delivery is not configured right now.");
        return;
      }
      if (code === "OTP_EMAIL_SEND_FAILED") {
        setRestoreError("Unable to send the verification email right now. Please try again shortly.");
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
        body: JSON.stringify({
          email: normalizedEmail,
          code: normalizedCode,
          purpose: loginModalPurpose,
        }),
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
        void refreshAccountSummary();
        return;
      }

      setHasProAccess(false);
      setEntitlementStatus("needs_restore");
      setProRestoreNotice("Logged in on this device.");
      setRestoreCode("");
      setRestoreStep("email");
      setShowLoginModal(false);
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
      if (code === "OTP_EMAIL_PROVIDER_NOT_CONFIGURED") {
        setRestoreError("Restore email delivery is not configured right now.");
        return;
      }
      if (code === "OTP_EMAIL_SEND_FAILED") {
        setRestoreError("Unable to send the verification email right now. Please try again shortly.");
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

  function updateWorkspaceUrl(id: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.delete("evaluation_id");
    url.searchParams.delete("checkout_canceled");
    if (id) url.searchParams.set("evaluation_id", id);
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function startAssignment(projectId: string | null = null) {
    if (workspaceBusy || isResumingCheckout) return;
    openRequestRef.current++;
    evaluationAttemptRef.current = null;
    setActiveProjectId(projectId);
    setDraftProjectId(projectId);
    setSampleSelected(false);
    setTrialPreview(null);
    setWorkspaceView("compose");
    setGradeResult(null);
    setResultMode(null);
    setRubricText(""); setAssignmentText("");
    clearFile("rubric"); clearFile("assignment");
    setRubricMode("file"); setAssignmentMode("file");
    setSavedRubric(null); setAssignmentInstructions(""); setShowRubricLibrary(false);
    setError(""); setErrorCode(""); setWorkspaceNotice(""); setDraftRestoreNotice("");
    setExpandedRewriteSections({}); setShareFeedback("idle");
    updateWorkspaceUrl(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openProject(project: AssignmentProject) {
    if (workspaceBusy || isResumingCheckout) return;
    openRequestRef.current++;
    setActiveProjectId(project.id);
    setWorkspaceView("project");
    setGradeResult(null); setResultMode(null); setWorkspaceNotice("");
    updateWorkspaceUrl(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function openAssignment(item: AssignmentHistoryItem) {
    if (workspaceBusy || isResumingCheckout) return;
    const request = ++openRequestRef.current;
    const account = signedInEmail;
    setOpeningAssignment(true); setWorkspaceNotice("");
    try {
      const response = await fetch("/api/workspace/assignments/" + encodeURIComponent(item.id), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !isGradeResult(data.result, data.mode)) throw new Error(data.message || "Could not open this assignment.");
      if (request !== openRequestRef.current || currentAccountRef.current !== account) return;
      setResultOwnerEmail(account);
      setGradeResult(data.result); setResultMode(data.mode);
      setActiveProjectId(item.projectId); setWorkspaceView("result");
      setExpandedRewriteSections({}); setShareFeedback("idle");
      setError(""); setErrorCode("");
      updateWorkspaceUrl(item.id);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) {
      if (request === openRequestRef.current && currentAccountRef.current === account) setWorkspaceNotice(error instanceof Error ? error.message : "Could not open this assignment.");
    } finally { if (request === openRequestRef.current) setOpeningAssignment(false); }
  }

  return (
    <AssignmentSidebar
      canAccessAdmin={canAccessAdmin} onPricing={() => void goToPricingPage()} onLogout={() => void handleLogout()}
      email={signedInEmail} data={workspace.data} loading={workspace.loading} error={workspace.error}
      busy={workspaceBusy || isResumingCheckout || !draftReady || !resultReady}
      selectedId={gradeResult?.evaluation_id} projectId={activeAssignment?.projectId ?? activeProjectId}
      onNew={() => startAssignment()} onOpen={item => void openAssignment(item)} onProject={openProject}
      onLogin={() => maybeOpenLoginModal()} onRetry={() => void workspace.refresh()}
      onCreate={async name => { const project = await workspace.mutate({ action: "createProject", name }); if (project) openProject(project); }}
    >
    {showRubricLibrary && signedInEmail ? <RubricLibrary key={signedInEmail}
      onClose={() => setShowRubricLibrary(false)}
      onSelect={item => {
        setSavedRubric(item); setRubricMode("library"); clearFile("rubric"); setRubricText("");
        setShowRubricLibrary(false); setError("");
      }} /> : null}
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-14">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {workspaceNotice && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{workspaceNotice}</p>}
        {openingAssignment && <p role="status" className="text-sm text-slate-500">Opening assignment?</p>}
        {workspaceView === "compose" && activeProject ? <div className={workspaceStyles.contextBar}><div className={workspaceStyles.contextTitle}><WorkspaceIcon name="folder" /><button onClick={() => openProject(activeProject)}>{activeProject.name}</button><span>/ New version</span></div></div> : null}
        <section className={workspaceView === "compose" ? "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-8" : "relative overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-3"}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className={workspaceView === "compose" ? "relative mb-6 border-b border-slate-100 pb-5" : "relative"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col items-start gap-3">
                <Image src="/rubricheck-logo.svg" alt="RubriCheck logo" width={135} height={36} className="h-9 w-auto" />
                <h1 hidden={workspaceView !== "compose"} className="max-w-2xl text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                  {ACTIVE_LANDING_COPY.headline}
                </h1>
              </div>
              <div className="inline-flex items-center gap-2">
                {canShowAccountActions() ? (
                  <>
                    <Link
                      href={gradeResult?.evaluation_id ? "/pricing?evaluation_id=" + encodeURIComponent(gradeResult.evaluation_id) : "/pricing"}
                      onClick={(event: import("react").MouseEvent<HTMLAnchorElement>) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); void goToPricingPage(); } }}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Pricing
                    </Link>
                    {signedInEmail ? (
                      <>
                        <div ref={accountMenuRef} className="relative">
                          <button
                            type="button"
                            title={signedInEmail}
                            aria-haspopup="menu"
                            aria-expanded={showAccountMenu}
                            onClick={() => setShowAccountMenu((previous) => !previous)}
                            className="inline-flex items-center px-0.5 py-0.5 transition hover:opacity-90"
                          >
                            <span
                              aria-hidden="true"
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${getEmailInitialAvatarClassName(signedInEmail)}`}
                            >
                              {getEmailInitial(signedInEmail)}
                            </span>
                            <span className="sr-only">{signedInEmail}</span>
                          </button>
                          {showAccountMenu ? (
                            <div
                              role="menu"
                              className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                            >
                              <p className="truncate px-2 py-1 text-xs text-slate-500">{signedInEmail}</p>
                              {canAccessAdmin ? (
                                <Link
                                  href="/admin"
                                  role="menuitem"
                                  onClick={() => setShowAccountMenu(false)}
                                  className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                >
                                  Admin
                                </Link>
                              ) : null}
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
                        <div ref={billingMenuRef} className="relative">
                          <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={showBillingMenu}
                            onClick={() => {
                              setShowAccountMenu(false);
                              setShowBillingMenu((previous) => !previous);
                            }}
                            className="inline-flex items-center transition hover:opacity-90"
                            title="Open billing options"
                          >
                            <AccountStatusPill plan={accountPlan} remainingEvaluations={remainingEvaluations} />
                          </button>
                          {showBillingMenu ? (
                            <div
                              role="menu"
                              className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                            >
                              <Link
                                href="/billing/manage"
                                role="menuitem"
                                onClick={() => setShowBillingMenu(false)}
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                Billing and refunds
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => maybeOpenLoginModal()}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                      >
                        Log in
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
            <p hidden={workspaceView !== "compose"} className="mt-2 text-sm text-slate-600 md:text-[15px]">
              {ACTIVE_LANDING_COPY.subtitle}
            </p>
            <nav hidden={workspaceView !== "compose"} aria-label="Draft review guides" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-indigo-700">
              <Link href="/essay-rubric-checker" className="underline underline-offset-4">Check an essay against a rubric</Link>
              <Link href="/assignment-rubric-checker" className="underline underline-offset-4">Check assignment requirements</Link>
              <Link href="/how-to-use-a-rubric-to-check-an-assignment" className="underline underline-offset-4">How to use a rubric</Link>
            </nav>
          </div>

          {!signedInEmail && workspaceView === "compose" ? <>
            <GuestChoices sampleSelected={sampleSelected} disabled={workspaceBusy} onSelect={setSampleSelected} />
            {sampleSelected ? <SampleExperience onTryOwn={() => setSampleSelected(false)} /> : null}
          </> : null}

          <form hidden={workspaceView !== "compose" || (!signedInEmail && sampleSelected)} id="rubric-checker" className="scroll-mt-6 space-y-6" onSubmit={handleSubmit}>
            <fieldset disabled={!draftReady || (!signedInEmail && !resultReady)} className="space-y-6">
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
                    <TabButton active={rubricMode === "general"} onClick={() => switchRubricMode("general")}>
                      No rubric
                    </TabButton>
                  </div>
                </div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <button type="button" disabled={isLoading} onClick={() => signedInEmail ? setShowRubricLibrary(true) : maybeOpenLoginModal("Log in to open your saved rubrics.")}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true"><path d="M4 5h16v4H4zM6 9v11h12V9M10 13h4" /></svg>
                    My rubrics
                  </button>
                  {rubricMode === "library" ? <span className="text-xs text-slate-500">Saved rubric</span> : null}
                </div>

                {rubricMode === "general" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-800">General criteria</h3>
                      <ul className="mt-3 space-y-2 text-xs text-slate-600">
                        {generalRubric().criteria.map(criterion => <li key={criterion.name} className="flex justify-between gap-3"><span>{criterion.name}</span><span>{criterion.max_score}%</span></li>)}
                      </ul>
                    </div>
                    <label className="block text-xs font-medium text-slate-600">Assignment instructions <span className="font-normal text-slate-400">(optional)</span>
                      <textarea rows={5} value={assignmentInstructions} maxLength={ASSIGNMENT_INSTRUCTIONS_LIMIT} onChange={event => setAssignmentInstructions(event.target.value)}
                        placeholder="Paste the assignment question or instructions"
                        className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                    </label>
                  </div>
                ) : rubricMode === "library" && savedRubric ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="break-words text-sm font-semibold text-slate-800">{savedRubric.name}</h3>
                    <RubricDownloads rubric={savedRubric} />
                    <details className="mt-4 text-xs text-slate-600"><summary className="cursor-pointer">View rubric text</summary>
                      <p className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words leading-6">{savedRubric.text}</p>
                    </details>
                  </div>
                ) : rubricMode === "file" ? (
                  <div className="space-y-3">
                    <input
                      id={rubricFileInputId}
                      ref={rubricInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                      className="hidden"
                      onBlur={restoreBrowserFocus}
                      onChange={(event) => handleFileInputChange("rubric", event)}
                    />
                    <input
                      id={rubricCameraInputId}
                      ref={rubricCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onBlur={restoreBrowserFocus}
                      onChange={(event) => handleFileInputChange("rubric", event, "append")}
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
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <label
                          htmlFor={rubricFileInputId}
                          className="inline-flex cursor-pointer rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          Choose File
                        </label>
                        <label
                          htmlFor={rubricCameraInputId}
                          className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          Take Photo
                        </label>
                      </div>
                    </div>
                    {rubricFiles.length > 0 ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-700">
                            {rubricFiles.length} file{rubricFiles.length > 1 ? "s" : ""} selected (
                            {formatFileSize(rubricFiles.reduce((sum, file) => sum + file.size, 0))})
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {rubricFiles.map((file) => file.name).join(", ")}
                          </p>
                        </div>
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
                      multiple
                      accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                      className="hidden"
                      onBlur={restoreBrowserFocus}
                      onChange={(event) => handleFileInputChange("assignment", event)}
                    />
                    <input
                      id={assignmentCameraInputId}
                      ref={assignmentCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onBlur={restoreBrowserFocus}
                      onChange={(event) => handleFileInputChange("assignment", event, "append")}
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
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <label
                          htmlFor={assignmentFileInputId}
                          className="inline-flex cursor-pointer rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          Choose File
                        </label>
                        <label
                          htmlFor={assignmentCameraInputId}
                          className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          Take Photo
                        </label>
                      </div>
                    </div>
                    {assignmentFiles.length > 0 ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-700">
                            {assignmentFiles.length} file{assignmentFiles.length > 1 ? "s" : ""} selected (
                            {formatFileSize(assignmentFiles.reduce((sum, file) => sum + file.size, 0))})
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {assignmentFiles.map((file) => file.name).join(", ")}
                          </p>
                        </div>
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
                disabled={isLoading || !draftReady || isResumingCheckout}
                className="min-w-0 flex-1 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-indigo-400 active:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!signedInEmail ? trialUsed ? "Sign up for 3 free checks" : "Get my free summary" : "Grade my assignment"}
              </button>
              {signedInEmail ? <button
                type="button"
                onClick={handleStrictSubmit}
                disabled={isLoading || !draftReady || isResumingCheckout}
                className="shrink-0 min-w-[9.25rem] rounded-xl border border-rose-300 bg-rose-50 px-5 py-2 text-xs font-semibold text-rose-700 transition-colors duration-150 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{"\u{1F525}"} Strict Mode</span>
              </button> : null}
            </div>
            {isLoading ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600 md:text-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <span className="leading-5">{loadingMessage}</span>
              </div>
            ) : null}
            </fieldset>
          </form>
        </section>

        {workspaceView === "project" && activeProject ? (
          <AssignmentProjectView key={activeProject.id} project={activeProject} assignments={workspace.data.assignments} busy={workspaceBusy}
            onOpen={item => void openAssignment(item)} onNewVersion={() => startAssignment(activeProject.id)}
            onRename={async name => { await workspace.mutate({ action: "renameProject", id: activeProject.id, name }); }}
            onDelete={async () => { await workspace.mutate({ action: "deleteProject", id: activeProject.id }); startAssignment(); }}
          />
        ) : null}

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
                Free trial limit reached
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {SHOW_ACCOUNT_AND_PRICING
                  ? `You used ${dailyLimitValue ?? FREE_TRIAL_EVALUATIONS} free evaluations for this account.`
                  : `You used ${dailyLimitValue ?? FREE_TRIAL_EVALUATIONS} free evaluations for this device.`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {openOperationsLimitMessage()}
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDailyLimitAlert(false)}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  Close
                </button>
                {shouldShowPricingCta() ? (
                  <Link
                    href={gradeResult?.evaluation_id ? "/pricing?evaluation_id=" + encodeURIComponent(gradeResult.evaluation_id) : "/pricing"}
                      onClick={(event: import("react").MouseEvent<HTMLAnchorElement>) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); void goToPricingPage(); } }}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Go to Pricing
                  </Link>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {showStrictModeUpgradeModal ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close Strict Mode upgrade prompt"
              onClick={() => setShowStrictModeUpgradeModal(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="strict-mode-upgrade-title"
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <div className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                Strict Mode
              </div>
              <h2 id="strict-mode-upgrade-title" className="mt-3 text-lg font-semibold text-slate-900">
                Strict Mode is locked
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Strict Mode is available with Pro or purchased top-ups.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Go to pricing to upgrade or buy credits?
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowStrictModeUpgradeModal(false)}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={goToPricingPage}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Go to Pricing
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <section hidden={workspaceView !== "compose" || (!comparisonImages.length && !canAccessAdmin)} className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_58%,#eef2ff_100%)] p-4 shadow-sm md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">RubriCheck vs Real Gallery</h2>
            <div className="flex items-center gap-2">
              {canAccessAdmin ? (
                <button
                  type="button"
                  onClick={openAdminCombineModal}
                  disabled={!gradeResult}
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Combine
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsComparisonCollapsed((previous) => !previous)}
                aria-expanded={!isComparisonCollapsed}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {isComparisonCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!isComparisonCollapsed ? (
            comparisonImages.length > 0 ? (
              <div className="relative mt-2 rounded-xl border border-slate-200/80 bg-white/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                {canScrollComparisonLeft ? (
                  <button
                    type="button"
                    onClick={() => handleScrollComparisonGallery("left")}
                    className="absolute -left-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                    aria-label="Scroll gallery left"
                  >
                    {"<"}
                  </button>
                ) : null}
                {canScrollComparisonRight ? (
                  <button
                    type="button"
                    onClick={() => handleScrollComparisonGallery("right")}
                    className="absolute -right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                    aria-label="Scroll gallery right"
                  >
                    {">"}
                  </button>
                ) : null}
                <div
                  ref={comparisonGalleryRef}
                  onScroll={updateComparisonGalleryScrollState}
                  className="flex gap-2 overflow-x-auto px-0.5 pb-0.5 pt-0.5 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {comparisonImages.map((image) => (
                    <button
                      key={image.src}
                      type="button"
                      onClick={() => setSelectedComparisonImage(image)}
                      className="w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-200 md:w-28 lg:w-32"
                    >
                      <div className="flex h-20 items-center justify-center bg-slate-100 p-1.5 md:h-24">
                        <Image
                          src={image.src}
                          alt={image.name}
                          width={1200}
                          height={800}
                          unoptimized
                          className="max-h-full w-auto rounded-md border border-slate-200 bg-white object-contain"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-xs text-slate-600">
                Add images to `public/comparison/` to show the gallery.
              </div>
            )
          ) : null}
        </section>

        {showAdminCombineModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close combine image modal"
              onClick={closeAdminCombineModal}
              className="absolute inset-0 bg-slate-950/60"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="combine-modal-title"
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <h2 id="combine-modal-title" className="text-lg font-semibold text-slate-900">
                Create Combined Image
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                RubriCheck score: {gradeResult ? formatOverallScoreDisplay(gradeResult.overall_range) : "-"} / 100
              </p>
              <form className="mt-4 space-y-4" onSubmit={handleAdminCombineSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  Real score
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.1}
                    value={adminRealScoreInput}
                    onChange={(event) => setAdminRealScoreInput(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g. 87"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Real image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAdminRealImageFileChange}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
                  />
                  {adminRealScoreImageFile ? (
                    <p className="mt-1 text-xs text-slate-500">{adminRealScoreImageFile.name}</p>
                  ) : null}
                </label>
                {adminCombineError ? <p className="text-sm text-red-600">{adminCombineError}</p> : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAdminCombineModal}
                    disabled={isAdminCombining}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdminCombining}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAdminCombining ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {selectedComparisonImage ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close comparison image preview"
              onClick={() => setSelectedComparisonImage(null)}
              className="absolute inset-0 bg-slate-950/70"
            />
            <div className="relative w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setSelectedComparisonImage(null)}
                className="absolute right-3 top-3 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              <div className="flex max-h-[84vh] items-center justify-center p-2 pt-8">
                <Image
                  src={selectedComparisonImage.src}
                  alt={selectedComparisonImage.name}
                  width={2200}
                  height={1600}
                  unoptimized
                  className="h-auto max-h-[78vh] w-auto rounded-lg object-contain"
                />
              </div>
            </div>
          </div>
        ) : null}

        {trialPreview && (!sampleSelected || signedInEmail) && workspaceView !== "project" ? (
          <GuestSummary result={trialPreview} signedIn={Boolean(signedInEmail)} busy={!resultReady}
            onUnlock={() => signedInEmail ? setTrialRestoreAttempt(value => value + 1) : openLoginModal("Sign up to see feedback for each criterion. 3 free checks · No card required.")} />
        ) : null}

        {gradeResult && resultOwnerEmail === signedInEmail && workspaceView !== "project" ? (
          <section ref={evaluationCaptureRef} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className={workspaceStyles.contextBar}>
              <div className={workspaceStyles.contextTitle}>
                <WorkspaceIcon name={activeAssignment?.projectId ? "folder" : "file"} />
                {activeAssignment?.projectId ? <button onClick={() => { const project = workspace.data.projects.find(project => project.id === activeAssignment.projectId); if (project) openProject(project); }}>{workspace.data.projects.find(project => project.id === activeAssignment.projectId)?.name}</button> : <span>Assignment</span>}
                {activeAssignment?.projectId && <span> / V{projectVersions(workspace.data.assignments, activeAssignment.projectId).findIndex(item => item.id === activeAssignment.id) + 1}</span>}
              </div>
              <div className={workspaceStyles.contextActions}>
                {activeAssignment && <select aria-label="Move assignment to project" value={activeAssignment.projectId ?? ""} disabled={workspaceBusy} onChange={async event => {
                  const projectId = event.target.value || null;
                  try { await workspace.mutate({ action: "moveAssignment", id: activeAssignment.id, projectId }); setActiveProjectId(projectId); }
                  catch (error) { setWorkspaceNotice(error instanceof Error ? error.message : "Could not move assignment."); }
                }}><option value="">No project</option>{workspace.data.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
                {activeAssignment?.projectId && <button className={workspaceStyles.secondaryButton} disabled={workspaceBusy} onClick={() => startAssignment(activeAssignment.projectId)}>New version</button>}
              </div>
            </div>
            <div className="border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  ref={evaluationHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-slate-900 focus:outline-none"
                >
                  Evaluation Summary
                </h2>
                {gradeResult.grading_basis === "general" ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">General criteria</span> : null}
                {resultMode === "strict" ? (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    {"\u{1F525}"} Strict Mode
                  </span>
                ) : null}
                {gradeResult.hidden_ai_alert ? (
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Hidden AI text detected
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <div>
                {gradeResult.hidden_ai_alert ? (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">
                      {formatHiddenAiAlertSources(gradeResult.hidden_ai_alert.sources)} warning
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      {gradeResult.hidden_ai_alert.message}
                    </p>
                  </div>
                ) : null}
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
                      disabled={isSharingImage}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                    >
                      {isSharingImage
                        ? "Sharing..."
                        : shareFeedback === "copied"
                            ? "Image copied"
                            : shareFeedback === "downloaded"
                            ? "Downloaded"
                            : "Share"}
                    </button>
                  </div>
                  {shareFeedback !== "idle" && shareFeedback !== "copied" ? (
                    <p
                      aria-live="polite"
                      className={`mt-2 text-xs leading-5 md:text-sm ${
                        shareFeedback === "failed" ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {shareFeedback === "downloaded"
                            ? "Your browser blocked image clipboard access, so a PNG was downloaded instead."
                            : "Could not generate the results image. Please try again."}
                    </p>
                  ) : null}
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 md:text-sm">
                    {SCORE_RANGE_NOTICE}
                  </p>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 md:text-sm">
                    {explainScoreCalculation(gradeResult)}
                  </p>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500 md:text-sm">
                    {SCORE_COMPARISON_NOTICE}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700 md:text-[15px]">{gradeResult.summary}</p>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-900">Top Improvements</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {getVisibleTopImprovements(gradeResult).map((item, index) => (
                    <li key={`${index}-${item}`}>{item}</li>
                  ))}
                  {Array.from({ length: getLockedTopImprovementsCount(gradeResult) }).map((_, index) => (
                    <li key={`locked-improvement-${index}`} className="list-none pl-0">
                      <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                        <p aria-hidden="true" className="select-none text-slate-400 blur-[4px]">
                          Unlock another prioritized improvement with Pro or purchased credits.
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {getLockedTopImprovementsCount(gradeResult) > 0 ? (
                  <p className="mt-2 text-xs font-medium text-indigo-700">{LOCKED_TOP_IMPROVEMENTS_NOTICE}</p>
                ) : null}
              </div>
            </div>

            {SHOW_PRO_FEATURES && !hasProAccess ? (
              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  {!signedInEmail ? (
                    <button
                      type="button"
                      onClick={() => openLoginModal()}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-auto"
                    >
                      Log in
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={goToPricingPage}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-auto"
                  >
                    Upgrade to Pro
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-indigo-900/80 md:text-sm">
                  {signedInEmail
                    ? "You're logged in on this device. Upgrade to Pro to unlock rewrite suggestions."
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
              <table className="min-w-full table-fixed divide-y divide-slate-200 text-left text-sm">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                  <col className="w-[52%]" />
                </colgroup>
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
                    const rationaleText = getCriterionPrimaryFeedbackText(item);
                    const evidenceList = item.evidence ?? [];
                    const resultAccessTier = gradeResult.access_tier;
                    const canShowDetailedBreakdown = SHOW_PRO_FEATURES && canAccessDetailedFeedback(resultAccessTier);
                    const canShowRewriteSuggestions = SHOW_PRO_FEATURES && canAccessRewriteSuggestions(resultAccessTier);
                    const rewriteSuggestions =
                      canShowRewriteSuggestions && Array.isArray(item.example_revisions)
                        ? item.example_revisions
                            .map((revision) => revision.trim())
                            .filter((revision) => revision.length > 0)
                            .slice(0, 2)
                        : [];
                    const isDetailedBreakdownLocked = item.detailed_breakdown_locked === true;
                    const detailedBreakdownBullets =
                      canShowDetailedBreakdown && item.detailed_breakdown
                        ? splitDetailedBreakdownBullets(item.detailed_breakdown)
                        : [];
                    const showDetailedBreakdownLockNotice =
                      SHOW_PRO_FEATURES &&
                      !canShowDetailedBreakdown &&
                      isDetailedBreakdownLocked;

                    return (
                      <tr key={criteriaKey}>
                        <td className="whitespace-normal break-words px-4 py-3 align-top font-medium">{item.name}</td>
                        <td className="px-4 py-3 align-top">{item.max_score}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-sm font-medium text-indigo-700">
                            {formatEstimatedRangeDisplay(item.estimated_range, "-")}
                          </span>
                        </td>
                        <td className="whitespace-normal break-words px-4 py-3 align-top">
                          <p>{rationaleText}</p>
                          {detailedBreakdownBullets.length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                              {detailedBreakdownBullets.map((bullet, bulletIndex) => (
                                <li key={`${criteriaKey}-detail-${bulletIndex}`}>{bullet}</li>
                              ))}
                            </ul>
                          ) : null}
                          {showDetailedBreakdownLockNotice ? (
                            <div className="mt-2 space-y-2">
                              <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                                <p aria-hidden="true" className="select-none text-xs text-slate-400 blur-[4px]">
                                  Detailed criterion feedback is hidden on Free. Unlock the full explanation and supporting notes.
                                </p>
                              </div>
                              <p className="text-xs font-medium text-indigo-700">{LOCKED_DETAILED_FEEDBACK_NOTICE}</p>
                            </div>
                          ) : null}
                          {canShowDetailedBreakdown && evidenceList.length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                              {evidenceList.map((snippet, snippetIndex) => (
                                <li key={`${criteriaKey}-evidence-${snippetIndex}`}>{snippet}</li>
                              ))}
                            </ul>
                          ) : null}
                          {SHOW_PRO_FEATURES ? (
                            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80">
                              <button
                                type="button"
                                onClick={() => toggleRewriteSection(criteriaKey)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100/70"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Rewrite suggestions</span>
                                  <ProBadge className="shrink-0" />
                                </span>
                                <span className="text-xs font-medium text-slate-500">
                                  {isRewriteOpen ? "Hide" : "Show"}
                                </span>
                              </button>
                              {isRewriteOpen ? (
                                <div className="border-t border-slate-200 px-3 py-3">
                                  {canShowRewriteSuggestions ? (
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
                                        {hasProAccess
                                          ? "Rewrite suggestions were not generated for this evaluation. Run Evaluate again with Pro active to refresh this section."
                                          : "Rewrite suggestions are a Pro feature to help you earn a better score. Log in or upgrade to unlock."}
                                      </p>
                                      {!hasProAccess ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {!signedInEmail ? (
                                            <button
                                              type="button"
                                              onClick={() => openLoginModal()}
                                              className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                            >
                                              Log in
                                            </button>
                                          ) : null}
                                          <button
                                            type="button"
                                            onClick={goToPricingPage}
                                            className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                          >
                                            Upgrade to Pro
                                          </button>
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:hidden">
              {gradeResult.criteria.map((item, index) => {
                const criteriaKey = `criteria-${index}-${item.name}`;
                const isRewriteOpen = Boolean(expandedRewriteSections[criteriaKey]);
                const rationaleText = getCriterionPrimaryFeedbackText(item);
                const evidenceList = item.evidence ?? [];
                const resultAccessTier = gradeResult.access_tier;
                const canShowDetailedBreakdown = SHOW_PRO_FEATURES && canAccessDetailedFeedback(resultAccessTier);
                const canShowRewriteSuggestions = SHOW_PRO_FEATURES && canAccessRewriteSuggestions(resultAccessTier);
                const rewriteSuggestions =
                  canShowRewriteSuggestions && Array.isArray(item.example_revisions)
                    ? item.example_revisions
                        .map((revision) => revision.trim())
                        .filter((revision) => revision.length > 0)
                        .slice(0, 2)
                    : [];
                const isDetailedBreakdownLocked = item.detailed_breakdown_locked === true;
                const detailedBreakdownBullets =
                  canShowDetailedBreakdown && item.detailed_breakdown
                    ? splitDetailedBreakdownBullets(item.detailed_breakdown)
                    : [];
                const showDetailedBreakdownLockNotice =
                  SHOW_PRO_FEATURES &&
                  !canShowDetailedBreakdown &&
                  isDetailedBreakdownLocked;

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
                      <div className="mt-2 space-y-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                          <p aria-hidden="true" className="select-none text-xs text-slate-400 blur-[4px]">
                            Detailed criterion feedback is hidden on Free. Unlock the full explanation and supporting notes.
                          </p>
                        </div>
                        <p className="text-xs font-medium text-indigo-700">{LOCKED_DETAILED_FEEDBACK_NOTICE}</p>
                      </div>
                    ) : null}
                    {canShowDetailedBreakdown && evidenceList.length > 0 ? (
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
                          <span className="inline-flex items-center gap-2">
                            <span>Rewrite suggestions</span>
                            <ProBadge className="shrink-0" />
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {isRewriteOpen ? "Hide" : "Show"}
                          </span>
                        </button>
                        {isRewriteOpen ? (
                          <div className="border-t border-slate-200 px-3 py-3">
                            {canShowRewriteSuggestions ? (
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
                                  {hasProAccess
                                    ? "Rewrite suggestions were not generated for this evaluation. Run Evaluate again with Pro active to refresh this section."
                                    : "Rewrite suggestions are a Pro feature to help you earn a better score. Log in or upgrade to unlock."}
                                </p>
                                {!hasProAccess ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {!signedInEmail ? (
                                      <button
                                        type="button"
                                        onClick={() => openLoginModal()}
                                        className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                      >
                                        Log in
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={goToPricingPage}
                                      className="inline-flex rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                    >
                                      Upgrade to Pro
                                    </button>
                                  </div>
                                ) : null}
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

        {SHOW_ACCOUNT_AND_PRICING && showLoginModal ? (
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
              {trialPreview || trialUsed ? "Sign up or log in" : "Log in"}
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

        {!gradeResult && workspaceView === "compose" ? (
          <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,#fcfdff_0%,#f3f6fb_100%)] p-5 shadow-[0_28px_70px_-52px_rgba(15,23,42,0.5)] md:p-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-sky-200/35 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-amber-100/60 blur-3xl"
            />

            <div className="relative">
              <div className="mb-6 flex flex-col gap-3 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    More About RubriCheck
                  </p>
                </div>
                <div className="inline-flex self-start rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  Product details
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-[1.75rem] border border-amber-200/70 bg-[linear-gradient(180deg,#fffdf7_0%,#fff6e7_100%)] p-6 shadow-[0_18px_40px_-34px_rgba(180,83,9,0.35)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-3xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700/80">
                        Product Overview
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        AI rubric checking for assignments before submission
                      </h2>
                    </div>
                    <div className="inline-flex rounded-full border border-amber-300/70 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-800">
                      Student workflow
                    </div>
                  </div>

                  <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700 md:text-[15px]">
                    RubriCheck is built for students who want a rubric-based draft check before they submit. Upload the
                    rubric and assignment, review likely score ranges, and focus on the changes most likely to improve
                    your result.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {HOME_PRODUCT_TAGS.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-full border border-amber-200 bg-white/75 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {HOME_PRODUCT_HIGHLIGHTS.map((item) => (
                      <article
                        key={item.title}
                        className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Highlight
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="grid gap-4">
                  <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Use Cases</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                          Explore rubric checker use cases
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Find a guide for your essay, report, or assignment, and learn how to turn rubric feedback
                          into your next revision.
                        </p>
                      </div>
                      <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                        Explore
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      {HOME_INTERNAL_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="group flex items-start justify-between gap-4 rounded-2xl border border-transparent px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-slate-900">{link.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{link.description}</p>
                          </div>
                          <span className="mt-0.5 shrink-0 text-sm font-semibold text-slate-400 transition group-hover:text-slate-700">
                            Open
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/82 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">FAQ</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">RubriCheck FAQ</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Learn what to upload, how to interpret your results, and what is included in the free trial.
                        </p>
                      </div>
                      <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                        Quick answers
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {HOME_FAQ_ITEMS.map((item) => (
                        <article
                          key={item.question}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                        >
                          <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
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
              <FeedbackButton email={signedInEmail} />
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
    </AssignmentSidebar>
  );
}

