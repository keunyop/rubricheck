import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { parseQuizFile } from "./quizParse.ts";
import { makePdf } from "./testFixtures/pdf.ts";
import { docxFixture } from "./testFixtures/docx.ts";

test("quiz PDF selection preserves true page numbers without including excluded text", async () => {
  const file = makePdf(["First page contains private excluded information.", "Second page explains that a triangle has three sides."]);
  const parsed = await parseQuizFile(file, "2");
  assert.equal(parsed.totalUnits, 2);
  assert.equal(parsed.segments.length, 1);
  assert.equal(parsed.segments[0].unit, 2);
  assert.match(parsed.segments[0].text, /triangle/);
  assert.doesNotMatch(parsed.segments[0].text, /private excluded/);
  await assert.rejects(parseQuizFile(file, "3"), /QUIZ_INVALID_RANGE/);
});

test("TXT and DOCX use paragraph locations, PPTX preserves slide scope", async () => {
  const text = "A triangle has three sides.\n\nA square has four equal sides.";
  const txt = await parseQuizFile(new File([text], "notes.txt"), "2");
  assert.equal(txt.unitKind, "paragraph");
  assert.equal(txt.segments[0].unit, 2);
  const docx = await parseQuizFile(await docxFixture(text.split("\n\n")), "2");
  assert.equal(docx.unitKind, "paragraph");
  assert.match(docx.segments[0].text, /square/);
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", '<p:sld><a:t>Excluded material</a:t></p:sld>');
  zip.file("ppt/slides/slide2.xml", '<p:sld><a:t>A square has four equal sides.</a:t></p:sld>');
  const ppt = await parseQuizFile(new File([await zip.generateAsync({ type: "arraybuffer" })], "lecture.pptx"), "2");
  assert.equal(ppt.unitKind, "slide");
  assert.equal(ppt.segments[0].unit, 2);
  assert.equal(ppt.segments[0].text, "A square has four equal sides.");
  zip.file("ppt/presentation.xml", '<p:presentation><p:sldIdLst><p:sldId id="2" r:id="rId2"/><p:sldId id="1" r:id="rId1"/></p:sldIdLst></p:presentation>');
  zip.file("ppt/_rels/presentation.xml.rels", '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>');
  const reordered = await parseQuizFile(new File([await zip.generateAsync({ type: "arraybuffer" })], "reordered.pptx"), "1");
  assert.equal(reordered.segments[0].unit, 1);
  assert.equal(reordered.segments[0].text, "A square has four equal sides.");
});

test("unreadable/oversized quiz sources are rejected instead of silently omitted", async () => {
  await assert.rejects(parseQuizFile(new File(["invalid"], "bad.pdf"), ""), /QUIZ_UNREADABLE_SOURCE/);
  await assert.rejects(parseQuizFile(new File(["text"], "bad.exe"), ""), /QUIZ_FILE_TYPE/);
  await assert.rejects(parseQuizFile(new File(["a".repeat(50001)], "long.txt"), ""), /QUIZ_SOURCE_LIMIT/);
  const long = makePdf(Array.from({ length: 51 }, () => "Enough text to read this source page without OCR."));
  await assert.rejects(parseQuizFile(long, ""), /QUIZ_SELECT_RANGE/);
  assert.equal((await parseQuizFile(long, "51")).segments[0].unit, 51);
});
