import { z } from "zod";
import { QUIZ_LIMITS, type QuizQuestion, type QuizSource, type QuizSourceRef, type SourceSelection } from "./quizTypes";

export class QuizError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) { super(code); this.name = "QuizError"; this.code = code; this.status = status; }
}

export function selectQuizSources(sources: QuizSource[], selections: SourceSelection[], now = Date.now()): { sources: QuizSource[]; refs: QuizSourceRef[] } {
  if (!sources.length || sources.length > QUIZ_LIMITS.sources || new Set(selections.map(s => s.id)).size !== selections.length) throw new QuizError("QUIZ_INVALID_SOURCES");
  let units = 0, characters = 0, bytes = 0;
  const selected = selections.map(selection => {
    const source = sources.find(s => s.id === selection.id);
    if (!source || source.expiresAt <= now) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
    if (new Set(selection.units).size !== selection.units.length || !selection.units.length) throw new QuizError("QUIZ_INVALID_RANGE");
    const segments = selection.units.map(unit => {
      const segment = source.segments.find(s => s.unit === unit);
      if (!segment) throw new QuizError("QUIZ_INVALID_RANGE");
      return segment;
    });
    if (source.unitKind !== "paragraph") units += segments.length;
    characters += segments.reduce((sum, s) => sum + s.text.length, 0);
    bytes += source.bytes;
    return { ...source, segments };
  });
  if (selected.filter(s => s.kind === "assignment").length > 1) throw new QuizError("QUIZ_INVALID_SOURCES");
  if (units > QUIZ_LIMITS.units || characters > QUIZ_LIMITS.characters || bytes > QUIZ_LIMITS.totalBytes) throw new QuizError("QUIZ_SOURCE_LIMIT");
  if (characters < 20) throw new QuizError("QUIZ_INSUFFICIENT_SOURCE");
  return { sources: selected, refs: selected.map(({ segments, feedback, ...source }) => { void feedback; return { ...source, units: segments.map(s => s.unit) }; }) };
}

export const generatedQuestionSchema = z.object({
  type: z.enum(["mcq", "true_false"]), question: z.string().trim().min(8).max(1500),
  options: z.array(z.string().trim().min(1).max(800)).min(2).max(4), answer: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(12).max(3000), concepts: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
  sourceId: z.string().uuid(), unit: z.number().int().positive(), evidence: z.string().trim().min(8).max(1500),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
export function validateQuizQuestions(raw: unknown, sources: QuizSource[], requested: number): GeneratedQuestion[] {
  const list = z.object({ questions: z.array(z.unknown()).max(40) }).safeParse(raw);
  if (!list.success) throw new QuizError("QUIZ_GENERATION_FAILED", 502);
  const seen = new Set<string>();
  const valid: GeneratedQuestion[] = [];
  for (const item of list.data.questions) {
    const parsed = generatedQuestionSchema.safeParse(item);
    if (!parsed.success) continue;
    const q = parsed.data, key = normalized(q.question);
    if (seen.has(key) || q.options.length !== (q.type === "mcq" ? 4 : 2) || q.answer >= q.options.length || new Set(q.options.map(normalized)).size !== q.options.length) continue;
    if (q.type === "true_false" && (q.options[0] !== "O" || q.options[1] !== "X")) continue;
    const segment = sources.find(s => s.id === q.sourceId)?.segments.find(s => s.unit === q.unit);
    if (!segment || !normalized(segment.text).includes(normalized(q.evidence))) continue;
    seen.add(key); valid.push(q);
    if (valid.length >= requested) break;
  }
  return valid;
}

export function persistedQuestions(questions: GeneratedQuestion[]): QuizQuestion[] {
  return questions.map(({ evidence, ...q }, index) => { void evidence; return { ...q, id: String(index + 1) }; });
}

export function parseUnitRange(value: string, maximum = 5000): number[] {
  if (!value.trim()) return [];
  const units = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new QuizError("QUIZ_INVALID_RANGE");
    const start = Number(match[1]), end = Number(match[2] ?? start);
    if (start < 1 || end < start || end > maximum || end - start > 5000) throw new QuizError("QUIZ_INVALID_RANGE");
    for (let n = start; n <= end; n++) units.add(n);
  }
  return [...units].sort((a, b) => a - b);
}
