import type { Rubric } from "./schema";

type SourceCriterion = { name: string; max_score: number; description: string };
export type RubricSourceAudit = {
  kind: "unknown" | "scored" | "holistic" | "incomplete" | "points_conflict";
  rubric?: Rubric;
  rowMaxima?: number[];
  statedTotals?: number[];
};

const numberPattern = String.raw`\d+(?:\.\d+)?`;
const approximately = (a: number, b: number) => Math.abs(a - b) < 0.000001;
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
const totalLabel = /^(?:overall\s+(?:score|total)|(?:grand\s+)?total(?:\s+(?:points|score|marks))?|tong(?:\s+diem)?)(?:\s*[:=]|\s*$)/i;

function hasPointAdjustments(text: string): boolean {
  const normalized = fold(text);
  // Explicit numeric rules can span OCR lines. A casual EXTRA CREDIT label
  // inside a scored row is not a rule.
  const joined = normalized.replace(/\s+/g, " ");
  return /\b(?:deduct(?:ion)?|penalt(?:y|ies)|bonus|late\s+(?:work|submission)|tru)\b.{0,120}\d/.test(joined) ||
    /\bextra\s+credit\b[^\n]{0,120}\d/.test(normalized) ||
    /\d[^\n]{0,60}(?:points?|marks?|pts|%)\s+(?:deduct(?:ed|ion)?|penalt(?:y|ies)|bonus)\b/.test(normalized);
}

function hasScoreConversion(text: string): boolean {
  return /\b(?:convert(?:ed|s|ing|ion)?|rescal(?:e|ed|ing)|scaled|out\s+of|quy doi|thang diem)\b/i.test(fold(text));
}

function finish(criteria: SourceCriterion[], totals: number[], extras = ""): RubricSourceAudit {
  const sum = criteria.reduce((value, criterion) => value + criterion.max_score, 0);
  const diagnostics = { rowMaxima: criteria.map(row => row.max_score), statedTotals: totals };
  if (!criteria.length || criteria.some(row => !Number.isFinite(row.max_score) || row.max_score <= 0)) return { kind: "unknown" };
  // A total elsewhere in the document may summarize another section or a
  // converted scale. A mismatch alone cannot establish a source contradiction.
  if (totals.some(total => !approximately(total, sum))) return { kind: "unknown", ...diagnostics };
  if (extras) criteria[criteria.length - 1].description += `\nSupporting requirements (unscored):\n${extras}`;
  return { kind: "scored", ...diagnostics, rubric: { total_score: sum, criteria } };
}

/** Conservative, offline audit of recognizable scoring layouts. Unknown layouts
 * are delegated to extraction; a model mismatch alone is never source evidence. */
export function auditRubricSource(source: string): RubricSourceAudit {
  const text = source.replace(/\r\n?/g, "\n");
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  const totals: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const normalized = fold(lines[i]);
    if (totalLabel.test(normalized)) {
      const inline = normalized.match(new RegExp(`[:=]\\s*(${numberPattern})(?:\\s*(?:points|pts|marks|diem))?\\s*$`, "i"));
      const next = lines[i + 1]?.match(new RegExp(`^/?\\s*(${numberPattern})(?:\\s*(?:points|pts|marks|diem))?$`, "i"));
      if (inline || next) totals.push(Number((inline ?? next)![1]));
    }
  }
  // An explicit prose base total is distinct from conversion denominators and penalties.
  const proseOverallTotals: number[] = [];
  for (const match of fold(text).matchAll(/(?:total\s+(?:points|score|marks)\s+(?:for|of)\s+(?:(?:the|this)\s+)?(?:whole\s+)?(?:assignment|paper|essay|assessment)\s*(?:is|:|=)\s*|tong diem cua[^\n.]{1,70}?\bla\s+)(\d+(?:\.\d+)?)\s*(?:points|marks|diem)?/g)) {
    totals.push(Number(match[1]));
    proseOverallTotals.push(Number(match[1]));
  }
  const uniqueTotals = [...new Set(totals.filter(value => value > 0))];

  // LMS exports repeat alternative rating maxima before the actual Pts cell.
  // Only the terminal numeric Pts cell contributes; '--' means unscored.
  const marker = /this criterion is linked to a learning outcome\s*/gi;
  const markers = [...text.matchAll(marker)];
  if (markers.length && /criteria\s+ratings\s+pts/i.test(text)) {
    const criteria: SourceCriterion[] = [];
    const extras: string[] = [];
    let complete = true;
    markers.forEach((match, index) => {
      const block = text.slice(match.index! + match[0].length, markers[index + 1]?.index ?? text.length)
        .replace(/\n\s*(?:Total Points|Overall Score)\s*:[\s\S]*$/i, "").trim();
      const blockLines = block.split("\n").map(line => line.trim()).filter(Boolean);
      const last = blockLines.at(-1) ?? "";
      if (/^(?:--|—|–|n\/?a)$/i.test(last)) { extras.push(block); return; }
      const points = last.match(new RegExp(`^(${numberPattern})\\s*(?:pts|points|marks)$`, "i"));
      if (!points || !blockLines[0]) { complete = false; return; }
      if (Number(points[1]) === 0) { extras.push(block); return; }
      criteria.push({ name: blockLines[0], max_score: Number(points[1]), description: blockLines.slice(1, -1).join("\n") });
    });
    if (complete) {
      // Repeated titles may be legitimate independent rows. The model can
      // qualify them by section; never deduplicate scored rows by text alone.
      if (new Set(criteria.map(row => fold(row.name).replace(/\s+/g, " "))).size !== criteria.length) return { kind: "unknown" };
      if (criteria[0]) criteria[0].description = `${text.slice(0, markers[0].index).trim()}\n${criteria[0].description}`.trim();
      const result = finish(criteria, uniqueTotals, extras.join("\n"));
      return result.rubric && hasPointAdjustments(text) ? { kind: "unknown" } : result;
    }
    return { kind: "unknown" };
  }

  // Percentage headings + matching standalone /max cells encode weighted rows.
  // Grade-band percentages (70-100%) do not match this heading expression.
  const headings = [...text.matchAll(/^([^\n]{1,180}?)\s*\((\d+(?:\.\d+)?)%\)\s*$/gm)];
  if (headings.length >= 2 && approximately(headings.reduce((sum, match) => sum + Number(match[2]), 0), 100)) {
    const criteria: SourceCriterion[] = [];
    let complete = true;
    headings.forEach((match, index) => {
      const block = text.slice(match.index! + match[0].length, headings[index + 1]?.index ?? text.length);
      const maxima = [...block.matchAll(/^\s*\/\s*(\d+(?:\.\d+)?)\s*$/gm)];
      if (maxima.length !== 1 || !approximately(Number(maxima[0][1]), Number(match[2]))) { complete = false; return; }
      criteria.push({ name: match[1].trim(), max_score: Number(match[2]), description: block.trim() });
    });
    if (complete) {
      criteria[0].description = `${text.slice(0, headings[0].index).trim()}\n${criteria[0].description}`.trim();
      const result = finish(criteria, uniqueTotals);
      return result.rubric && hasPointAdjustments(text) ? { kind: "unknown" } : result;
    }
    return { kind: "unknown" };
  }

  // Numbered maximum-points tables: sequential row numbers, a text heading,
  // then a standalone numeric maximum. Require an explicit maximum header.
  const isMaxHeader = (line: string) => /^(?:maximum(?:\s+(?:points|marks|score))?|max\.?\s*(?:points|marks|score)|toi da)$/i.test(fold(line));
  const maxHeader = lines.findLastIndex(isMaxHeader);
  if (maxHeader >= 0) {
    const rows: SourceCriterion[] = [];
    let expected = 1;
    for (let i = maxHeader + 1; i < lines.length; i++) {
      if (lines[i] !== String(expected)) continue;
      let end = i + 1;
      while (end < Math.min(lines.length, i + 7) && !/^\d+(?:\.\d+)?$/.test(lines[end])) end++;
      if (end === i + 1 || end >= Math.min(lines.length, i + 7)) continue;
      rows.push({ name: lines.slice(i + 1, end).join(" "), max_score: Number(lines[end]), description: "" });
      expected++;
      i = end;
    }
    const sum = rows.reduce((value, row) => value + row.max_score, 0);
    const footer = lines.length >= 2 && totalLabel.test(fold(lines.at(-2)!)) && Number(lines.at(-1)) === sum;
    if (rows.length >= 2 && footer && lines.filter(isMaxHeader).length === 1 && proseOverallTotals.some(total => !approximately(total, sum))) {
      return { kind: "points_conflict", rowMaxima: rows.map(row => row.max_score), statedTotals: uniqueTotals };
    }
  }

  // Cropped scoring screenshots expose only some terminal /max cells. The last
  // cell is the overall total only when an explicit Overall Score label exists.
  const slash = [...text.matchAll(/^\s*\/\s*(\d+(?:\.\d+)?)\s*$/gm)].map(match => Number(match[1]));
  const inlinePoints = /^[^\n]*[a-z][^\n]*[ \t]+\d+(?:\.\d+)?[ \t]*(?:points|marks|pts)\)?[ \t]*$/im.test(text);
  if (/\bcriterion\s+score\b/i.test(text) && /\boverall\s+score\b/i.test(text) && slash.length >= 3 && !inlinePoints && !hasScoreConversion(text)) {
    const total = slash.at(-1)!;
    const maxima = slash.slice(0, -1);
    const sum = maxima.reduce((value, points) => value + points, 0);
    if (sum < total) return { kind: "incomplete", rowMaxima: maxima, statedTotals: [total] };
  }

  // Whole-paper letter-grade bands have one shared scale. No dimension receives
  // invented weights; retain all descriptors and thresholds in one criterion.
  const bands = [...text.matchAll(/^\s*([ABCDF][+-]?)\s*\n\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)(?:\s*(?:points|marks|pts))?\s*$/gm)];
  if (bands.length >= 3 && new Set(bands.map(match => match[1][0])).size === bands.length && bands.some(match => Number(match[2]) === 0)) {
    const total = Math.max(...bands.map(match => Number(match[3])));
    const ordered = bands.map(match => [Number(match[2]), Number(match[3])]).sort((a, b) => a[0] - b[0]);
    const orderedBands = ordered.every(([low, high], index) => low <= high && (index === 0 || low > ordered[index - 1][1]));
    const otherScoringEvidence = maxHeader >= 0 || /^\s*\/\s*\d/m.test(text) ||
      /^\s*\d+(?:\.\d+)?\s*(?:points|marks|pts)\s*$/im.test(text) ||
      /^.+\(\d+(?:\.\d+)?%\)\s*$/m.test(text) ||
      /\b(?:each|every|per)\s+(?:criterion|category|dimension)|\bseparately\b/i.test(text);
    if (total > 0 && orderedBands && uniqueTotals.every(value => approximately(value, total)) && !otherScoringEvidence && !hasPointAdjustments(text)) {
      return { kind: "holistic", rowMaxima: [total], statedTotals: [total], rubric: {
        total_score: total,
        criteria: [{ name: "Overall assessment", max_score: total, description: text.trim() }],
      } };
    }
  }
  return { kind: "unknown" };
}
