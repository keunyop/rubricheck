# Grading failure repair — November 3, 2026 (UTC−08:00)

The changes are local and have not been deployed. After the user explicitly approved original-input replay, all three archived input sets passed actual Google Vision/OpenAI processing and final result validation. The verified diagnostic records and their archived originals were then deleted. No customer text, original files, credentials, or model responses are included in this report or committed fixtures.

## Findings

| Record | Evidence | Repair |
| --- | --- | --- |
| `e3e8da83-82b1-4b14-a4ac-f376e3041cf6` | The DOCX contains native cover text and three images: a header and two rubric tables. `extractRawText` retained only 337 cover characters. Production logs show both `total_score` and `criteria` failing minimum-value validation. | Read native text and embedded images in document order; OCR the images using the existing provider. Classify an explicit empty criteria array as missing assessment criteria even if the model also returns a zero/null total. |
| `a0b2a86d-0530-4277-91c6-e2613246452c` | Same rubric bytes/size and extracted cover text as the preceding record, with another assignment DOCX. Local parsing confirms all three images reach the OCR hook. | Same shared DOCX extraction repair. |
| `ac45b5bb-2550-4b9d-85f7-113e476e7682` | Production logs show a `total_score` mismatch after both extraction attempts. The PDF contains independent Report, Presentation, and Q&A tables. Their 13 rows each allow 5 raw marks; section headings mention denominators of 50, 25, and 10 and course contributions of 20%, 10%, and 5%. In particular, the report's six rows sum to 30 despite its 50-point heading. | Distinguish an overall raw total from section denominators and course percentages. Preserve explicit row maxima. When there is no overall raw total for all extracted tables, sum those maxima rather than inventing a total from section headings. Real-provider replay extracted all 13 criteria at 5 marks each, total 65, and completed grading. |

The PDF handling does not reconstruct missing rows or implement a new course-weighting formula. It keeps the existing criterion-based scoring behavior. An actual stated overall raw total must still agree with the extracted criterion sum; persistent mismatches remain rejected. No application-side rescaling or unconditional total replacement was added.

## Implementation

- DOCX images are read even when the native text is long enough to pass readable-text validation. Text-only documents perform no OCR. Empty decorative images are allowed, while invalid images and provider outages fail instead of returning a partial cover-only document.
- OCR results for duplicate image bytes are reused within a document. All embedded-image requests share a 60-second deadline; each request retains its 20-second deadline. Work is limited to 50 unique images and 30 MiB of image content. External file access remains disabled, and generated HTML is never rendered.
- Mammoth is pinned to 1.11.0 because its document-transform API is version-sensitive. See the [Mammoth transform and image API documentation](https://github.com/mwilliamson/mammoth.js#document-transforms).
- Rubric extraction retains one bounded validation retry and rejects invalid numeric output. The approach continues to use application validation as described in [OpenAI's structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs).
- Structure cache version advances to `v3`, so previously cached structures are not reused under the changed extraction rules. Saved-rubric tests use the actual version constant and verify one refresh followed by reuse.

## Verification completed

The verified flow is upload/paste → extraction → rubric structure → evaluation → final result, with failed extraction preserving inputs and avoiding usage charges.

- Full unit/API suite: **289 passed, 0 failed**.
- Production build, including TypeScript: passed. The initial sandbox build could not download public Google Fonts; the network-enabled build passed.
- ESLint on changed TypeScript files and `git diff --check`: passed.
- Six browser suites passed against the local production build: grading errors, grading failures, rubric input recovery, rubric library, evaluation recovery, and guest trial. These use mocked API responses and synthetic content.
- API integration tests use real DOCX parsing with synthetic OOXML and mocked provider responses. They verify that recovered image text reaches the structuring model, OCR outages happen before billing, successful retry settles exactly once, and no failure archive is added after recovery.
- Regression coverage includes text/image ordering, image-only DOCX, native-only DOCX parity, blank decorative images, duplicate-image reuse, malformed DOCX, external-file rejection, provider failures, image limits, deadlines, empty criteria plus zero/null totals, multiple rubric tables, and persistent total mismatch rejection. Existing PDF, standalone-image OCR, deduction/bonus, free/paid usage, saved rubric, result recovery, and translation tests passed.
- Both original DOCX rubrics were initially parsed locally with an injected OCR stub: all three actual embedded images reached that hook, with cover text retained. Actual provider replay was performed separately after permission, as documented below.

## Original-input replay

All three original sets passed extraction, rubric structuring, AI evaluation, and finalization using the existing Google Vision configuration and `gpt-6-luna` for both model stages, matching the archived model settings. Replay bypassed customer quotas, billing, result saves, and rubric caches.

| Record | Extracted rubric / assignment characters | Validated criteria and maxima | Result |
| --- | --- | --- | --- |
| `e3e8da83-82b1-4b14-a4ac-f376e3041cf6` | 3,449 / 19,096 | 6 criteria: 10, 25, 25, 25, 10, 5; total 100 | Passed |
| `a0b2a86d-0530-4277-91c6-e2613246452c` | 3,449 / 15,584 | 6 criteria: 10, 25, 25, 25, 10, 5; total 100 | Passed |
| `ac45b5bb-2550-4b9d-85f7-113e476e7682` | 15,995 / 3,722 | 13 criteria at 5 marks each; total 65 | Passed |

The final checks assert the expected criterion counts and weights, nonnegative point scores within criterion maxima, ordered criterion ranges within their maxima, and an ordered overall percentage range bounded to 0–100. All assertions passed; no additional code changes were needed after the original-input replay.

## Diagnostic cleanup

After verification, only the three records above were deleted using `deleteGradingFailure`, the same storage helper used by the administrator's **Delete record** action. Each subsequent detail read returned `null`; the full failure inbox contained **0 records**. Other account data and saved evaluations were not changed. Temporary local inspection images and the browser-generated report artifact were removed.
