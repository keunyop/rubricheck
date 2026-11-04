import pdfParse from "pdf-parse/lib/pdf-parse.js";
import JSZip from "jszip";
import { posix } from "node:path";
import { parseFile, readPdfPagesWithOcr } from "./parse";
import { QUIZ_LIMITS, type QuizSegment, type QuizSource } from "../src/lib/quizTypes";
import { parseUnitRange, QuizError } from "../src/lib/quizValidation";

export function paragraphSegments(text: string): QuizSegment[] {
  return text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map((text, index) => ({ unit: index + 1, text }));
}

function chosenUnits(range: string, total: number) {
  const units = range.trim() ? parseUnitRange(range, total) : Array.from({ length: Math.min(total, QUIZ_LIMITS.units + 1) }, (_, i) => i + 1);
  if (units.length > QUIZ_LIMITS.units) throw new QuizError("QUIZ_SELECT_RANGE");
  return units;
}

function checkSegments(segments: QuizSegment[]) {
  if (!segments.length || segments.some(s => !s.text.trim() || !/[\p{L}\p{N}]/u.test(s.text))) throw new QuizError("QUIZ_UNREADABLE_SOURCE");
  if (segments.reduce((sum, s) => sum + s.text.length, 0) > QUIZ_LIMITS.characters) throw new QuizError("QUIZ_SOURCE_LIMIT");
}

const xmlText = (text: string) => text.replace(/&#x([a-f\d]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export async function parseQuizFile(file: File, range: string): Promise<Pick<QuizSource, "kind" | "unitKind" | "totalUnits" | "segments">> {
  if (!file.size || file.size > QUIZ_LIMITS.fileBytes) throw new QuizError("QUIZ_FILE_LIMIT");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx", "pptx", "txt", "png", "jpg", "jpeg"].includes(extension ?? "")) throw new QuizError("QUIZ_FILE_TYPE");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "pdf") {
    const pages = new Map<number, string>();
    const requested = range.trim() ? parseUnitRange(range) : [];
    if (requested.length > QUIZ_LIMITS.units) throw new QuizError("QUIZ_SELECT_RANGE");
    let total: number;
    try {
      const result = await pdfParse(new Uint8Array(buffer), { pagerender: async (page: { pageNumber: number; getTextContent: (options: object) => Promise<{ items: { str: string; transform: number[] }[] }> }) => {
        if (requested.length ? !requested.includes(page.pageNumber) : page.pageNumber > QUIZ_LIMITS.units) return "";
        const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let previousY: number | undefined;
        const text = content.items.map(item => { const prefix = previousY === item.transform[5] ? " " : "\n"; previousY = item.transform[5]; return prefix + item.str; }).join("").trim();
        pages.set(page.pageNumber, text); return "";
      } });
      total = result.numpages;
    } catch { throw new QuizError("QUIZ_UNREADABLE_SOURCE"); }
    const units = chosenUnits(range, total);
    const missing = units.filter(n => (pages.get(n)?.replace(/\s/g, "").length ?? 0) < 15);
    if (missing.length) {
      const ocr = await readPdfPagesWithOcr(buffer, missing, "assignment");
      for (const [n, text] of ocr) if (text.trim()) pages.set(n, text.trim());
    }
    const segments = units.map(unit => ({ unit, text: pages.get(unit) ?? "" }));
    checkSegments(segments);
    return { kind: "pdf", unitKind: "page", totalUnits: total, segments };
  }
  if (extension === "pptx") {
    let zip: JSZip;
    try { zip = await JSZip.loadAsync(buffer); } catch { throw new QuizError("QUIZ_UNREADABLE_SOURCE"); }
    let slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)\.xml$/)![1]) - Number(b.match(/slide(\d+)\.xml$/)![1]));
    const presentation = zip.file("ppt/presentation.xml"), relationships = zip.file("ppt/_rels/presentation.xml.rels");
    if (presentation || relationships) {
      if (!presentation || !relationships) throw new QuizError("QUIZ_UNREADABLE_SOURCE");
      for (const entry of [presentation, relationships]) {
        const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
        if (!size || size > 4 * 1024 * 1024) throw new QuizError("QUIZ_SOURCE_LIMIT");
      }
      const [documentXml, relationXml] = await Promise.all([presentation.async("string"), relationships.async("string")]);
      const targets = new Map<string, string>();
      for (const match of relationXml.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)) {
        const id = match[1].match(/\bId="([^"]+)"/)?.[1], target = match[1].match(/\bTarget="([^"]+)"/)?.[1];
        if (id && target && !/\bTargetMode="External"/.test(match[1])) targets.set(id, target.startsWith("/") ? target.slice(1) : posix.normalize("ppt/" + target));
      }
      // Slide file numbers are not presentation order after users reorder slides.
      slides = [...documentXml.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?\s*>/g)].map(match => targets.get(match[1]) ?? "");
      if (!slides.length || slides.some(path => !/^ppt\/slides\/slide\d+\.xml$/.test(path) || !zip.file(path))) throw new QuizError("QUIZ_UNREADABLE_SOURCE");
    }
    const units = chosenUnits(range, slides.length);
    const segments: QuizSegment[] = [];
    for (const unit of units) {
      const entry = zip.file(slides[unit - 1]);
      if (!entry) throw new QuizError("QUIZ_UNREADABLE_SOURCE");
      // Inspect the central-directory size before inflating untrusted Office XML.
      const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
      if (!size || size > 4 * 1024 * 1024) throw new QuizError("QUIZ_SOURCE_LIMIT");
      const xml = await entry.async("string");
      const text = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(match => xmlText(match[1])).join("\n").trim();
      // Image-only slides need a readable replacement; never silently omit them.
      segments.push({ unit, text });
    }
    checkSegments(segments);
    return { kind: "pptx", unitKind: "slide", totalUnits: slides.length, segments };
  }
  if (extension === "docx") {
    let zip: JSZip;
    try { zip = await JSZip.loadAsync(buffer); } catch { throw new QuizError("QUIZ_UNREADABLE_SOURCE"); }
    const totalSize = Object.values(zip.files).reduce((sum, file) => sum + ((file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
    if (totalSize > 60 * 1024 * 1024) throw new QuizError("QUIZ_SOURCE_LIMIT");
  }
  let text: string;
  try { text = await parseFile(file); }
  catch { throw new QuizError("QUIZ_UNREADABLE_SOURCE"); }
  const image = ["png", "jpg", "jpeg"].includes(extension!);
  const all = image ? [{ unit: 1, text }] : paragraphSegments(text);
  const units = range.trim() ? parseUnitRange(range, all.length) : all.map(s => s.unit);
  const segments = all.filter(s => units.includes(s.unit));
  checkSegments(segments);
  return { kind: image ? "image" : extension as "txt" | "docx", unitKind: image ? "image" : "paragraph", totalUnits: all.length, segments };
}
