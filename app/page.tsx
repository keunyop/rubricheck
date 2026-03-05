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
import html2canvas from "html2canvas";
import Image from "next/image";
import Link from "next/link";
import { useAccountSummary } from "./components/AccountSummaryProvider";
import { AccountStatusPill } from "./components/AccountStatusPill";
import { ProBadge } from "./components/ProBadge";
import { isKnownAdminEmail } from "../src/config/admin";
import { ACTIVE_LANDING_COPY } from "../src/config/copy";
import {
  canAccessDetailedFeedback,
  canAccessRewriteSuggestions,
  canUseStrictMode,
  getVisibleTopImprovementsCount,
  type AccountFeatureTier,
} from "../src/lib/accountFeatureAccess";
import { getEvaluateInterstitialDecision } from "../src/lib/evaluateInterstitial";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
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
  access_tier: AccountFeatureTier;
  overall_range: [number, number];
  summary: string;
  top_improvements: string[];
  criteria: CriteriaResult[];
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
const LOCKED_DETAILED_FEEDBACK_NOTICE = "Detailed feedback is locked. Buy credits or upgrade to Pro to unlock.";
const LOCKED_TOP_IMPROVEMENTS_NOTICE = "Buy credits or upgrade to Pro to unlock the remaining improvement priorities.";
const FREE_TRIAL_EVALUATIONS = 3;
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
  ctx.fillText("AI-estimated score range", leftTextX, leftCursorY);

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
  const rubricInputRef = useRef<HTMLInputElement | null>(null);
  const assignmentInputRef = useRef<HTMLInputElement | null>(null);
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
  const checkoutReturnSessionRef = useRef<string | null>(null);

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

  function requireSignedInForEvaluation(selectedMode: GradingMode): boolean {
    void selectedMode;
    if (!hasLoadedAccountSummary) {
      setError("Checking login status. Please try again.");
      setErrorCode("");
      return false;
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
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("checkout_session_id")?.trim() ?? "";
    if (!sessionId || checkoutReturnSessionRef.current === sessionId) {
      return;
    }

    checkoutReturnSessionRef.current = sessionId;
    let cancelled = false;

    async function finalizeCheckoutReturn() {
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
            ? "Payment received. Pro activation is still processing. Refresh in a moment if it does not update."
            : "Payment received. Your top-up is still processing. Refresh in a moment if it does not update.",
        );
      } catch {
        if (cancelled) {
          return;
        }

        setDraftRestoreNotice("Payment was successful, but final confirmation is still pending. Refresh in a moment.");
      } finally {
        if (!cancelled) {
          removeCheckoutSessionIdFromUrl();
        }
      }
    }

    void finalizeCheckoutReturn();

    return () => {
      cancelled = true;
    };
  }, [refreshAccountSummary, refreshEntitlementStatus]);

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

  function goToPricingPage() {
    setShowLoginModal(false);
    setShowStrictModeUpgradeModal(false);
    setShowAccountMenu(false);
    setShowBillingMenu(false);
    window.location.assign("/pricing");
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

    return hasTitle && hasAccessTier && hasSummary && hasOverallRange && hasTopImprovements && hasCriteria && hasStrictEvidence;
  }

  async function submitGrade(selectedMode: GradingMode) {
    if (isLoading) {
      return;
    }

    if (selectedMode === "strict" && !canUseCurrentStrictMode) {
      openStrictModeUpgradeModal();
      return;
    }

    if (!requireSignedInForEvaluation(selectedMode)) {
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

    const startedAt = performance.now();
    const startedAtIso = new Date().toISOString();

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
      const elapsedMs = performance.now() - startedAt;
      const requestId = response.headers.get("x-request-id") ?? "unknown";
      requestAnimationFrame(() => {
        console.log(
          `[RubriCheck][GradeTiming] mode=${selectedMode} totalMs=${elapsedMs.toFixed(1)} requestId=${requestId} startedAt=${startedAtIso}`,
        );
      });
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
    if (!canUseCurrentStrictMode) {
      openStrictModeUpgradeModal();
      return;
    }

    if (!requireSignedInForEvaluation("strict")) {
      return;
    }
    void submitGrade("strict");
  }

  async function handleLogout() {
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
    setSelectedComparisonImage(null);
    setShowAdminCombineModal(false);
    setAdminRealScoreInput("");
    setAdminRealScoreImageFile(null);
    setAdminCombineError("");
    setIsAdminCombining(false);

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
              </div>
              <div className="inline-flex items-center gap-2">
                {canShowAccountActions() ? (
                  <>
                    <Link
                      href="/pricing"
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
                <span>{"\u{1F525}"} Strict Mode</span>
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

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_58%,#eef2ff_100%)] p-4 shadow-sm md:p-5">
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

        {gradeResult ? (
          <section ref={evaluationCaptureRef} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
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
                    {"\u{1F525}"} Strict Mode
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <div>
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
                    This is an AI-estimated range based on your rubric. Use it as guidance before
                    submission.
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

