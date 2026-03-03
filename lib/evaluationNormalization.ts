const MAX_RATIONALE_LENGTH = 220;
const MAX_FEEDBACK_LENGTH = 1200;

function sanitizeSingleLine(value: string, maxLength: number): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeSummary(summary: unknown): unknown {
  if (typeof summary !== "string") {
    return summary;
  }

  const sentences = summary
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((part) => part.length > 0);

  const limited = sentences.slice(0, 2).join(" ").trim();
  return limited.slice(0, 280);
}

function normalizeTopImprovements(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value
    .filter((item) => typeof item === "string")
    .map((item) => sanitizeSingleLine(item, 120))
    .filter((item) => item.length > 0)
    .slice(0, 3);

  return normalized;
}

function normalizeEvidence(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeSingleLine(item, 220))
    .filter((item) => item.length > 0)
    .slice(0, 2);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeDetailedBreakdown(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\r\n/g, "\n").trim().slice(0, 2_400);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeExampleRevisions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeSingleLine(item, 300))
    .filter((item) => item.length > 0)
    .slice(0, 2);

  return normalized.length > 0 ? normalized : undefined;
}

function toRoundedInteger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric);
}

function normalizeCriteriaScores(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const row = item as Record<string, unknown>;
    const {
      evidence: _rawEvidence,
      detailed_breakdown: _rawDetailedBreakdown,
      example_revisions: _rawExampleRevisions,
      ...rest
    } = row;
    const estimated = Array.isArray(row.estimated_range) ? row.estimated_range : [];

    const low = toRoundedInteger(estimated[0]);
    const high = toRoundedInteger(estimated[1]);
    const scoreFromRange = low !== null && high !== null ? Math.round((low + high) / 2) : null;
    const score = toRoundedInteger(row.score) ?? scoreFromRange;

    const rationaleRaw =
      typeof row.rationale === "string"
        ? row.rationale
        : typeof row.feedback === "string"
          ? row.feedback
          : null;

    const feedbackRaw =
      typeof row.feedback === "string"
        ? row.feedback
        : typeof row.rationale === "string"
          ? row.rationale
          : null;

    const estimatedRange =
      low !== null && high !== null
        ? [low, high]
        : score !== null
          ? [score, score]
          : row.estimated_range;

    const evidence = normalizeEvidence(row.evidence);
    const detailedBreakdown = normalizeDetailedBreakdown(row.detailed_breakdown);
    const exampleRevisions = normalizeExampleRevisions(row.example_revisions);

    return {
      ...rest,
      score: score ?? row.score,
      rationale: rationaleRaw === null ? row.rationale : sanitizeSingleLine(rationaleRaw, MAX_RATIONALE_LENGTH),
      feedback: feedbackRaw === null ? row.feedback : sanitizeSingleLine(feedbackRaw, MAX_FEEDBACK_LENGTH),
      estimated_range: estimatedRange,
      ...(evidence ? { evidence } : {}),
      ...(detailedBreakdown ? { detailed_breakdown: detailedBreakdown } : {}),
      ...(exampleRevisions ? { example_revisions: exampleRevisions } : {}),
    };
  });
}

export function normalizeModelEvaluation(modelResult: unknown): unknown {
  if (!modelResult || typeof modelResult !== "object") {
    return modelResult;
  }

  const source = modelResult as Record<string, unknown>;

  return {
    ...source,
    summary: normalizeSummary(source.summary),
    top_improvements: normalizeTopImprovements(source.top_improvements),
    criteria_scores: normalizeCriteriaScores(source.criteria_scores),
  };
}
