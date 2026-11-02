# Grading failure repairs — November 1, 2026 (Vancouver)

The repair is in the local working tree and has not been deployed. Original-input replay used the existing Google Vision and OpenAI services after the user explicitly approved it. Replay bypassed account billing, evaluation quotas, saved results, and rubric caches. Customer documents and credentials are not included in this report or test fixtures.

## Findings and repairs

| Failure record | Evidence | Repair |
| --- | --- | --- |
| `c52117f7-60b4-4004-98b9-b01cdb216126` | Production logs identify a `total_score` validation mismatch. Both original DOCX files extract correctly; the rubric contains seven competence criteria without explicit numeric weights. | Preserve the source criteria and infer the base total from their weights when no total is stated. Retry an invalid model extraction once, with validation feedback. |
| `a97f323a-e970-4038-9182-d2c04c58e8eb` | Production logs identify the same `total_score` mismatch. The original rubric image contains eight weighted criteria totaling 100, and the assignment PDF extracts correctly. | Clarify that performance bands, totals, and subtotals are not additional criteria; preserve the explicit weights and stated total during the bounded retry. |
| `e87acee6-e73c-4e9c-bd34-78417f6a5370` | Original PNG OCR succeeds with 72 readable characters, but the former 200-character minimum raises `TEXT_EXTRACTION_FAILED`. | Validate readable content independently of its length. Empty and predominantly nontext output still fails. The same validation serves image, DOCX, and PDF extraction. |

AI output varies: fresh calls for the two structuring incidents can already produce valid totals. Their original cause is established by the production request logs; deterministic model-response fixtures reproduce the mismatch and verify recovery without changing weights in application code.

Rubric schema failures and malformed JSON now receive at most one complete re-extraction. Both calls share the original AI deadline. Only validated output enters the cache. Persistent invalid output is rejected, and provider errors, timeouts, and missing-criteria guidance keep their existing classifications. Neither internal retry creates a second account reservation or failure archive when recovery succeeds.

PDF extraction retains the sparse-native-text OCR hint separately from readable-content validation. Blank OCR or page labels alone cannot become a successful document. Actual short native text remains available when OCR is blank, and numbered scanned pages in mixed PDFs are selected for OCR.

## Verification

- All three archived input sets passed actual extraction, rubric structuring, AI evaluation, and finalization with the final repair. The DOCX case returned seven criteria totaling 7 inferred points; the short PNG returned one criterion; the weighted image/PDF case returned eight criteria totaling 100. Final checks assert nonnegative scores within criterion maxima and the expected criterion counts/totals.
- Full unit/API suite: **280 tests passed**. Coverage includes rubric cache isolation, malformed JSON, inconsistent totals, unchanged valid-call behavior, original-deadline enforcement, provider errors, free/paid reservation settlement and refunds, saved rubrics, grading, adjustments, translation, and recovery.
- The final PDF-focused suite passed **12 tests**, including blank/page-label-only OCR, actual short native text, numbered mixed scans, complete page batches, service failures, and blank companion pages.
- Production build, including TypeScript, changed-file ESLint, and `git diff --check` passed.
- Six browser suites passed against the local production build: `check_grading_errors`, `check_grading_failures`, `check_rubric_input_recovery`, `check_rubric_library`, `check_evaluation_recovery`, and `check_guest_trial`. They cover English/Korean error recovery and mobile layouts; twelve English/Korean/Malay text/file input combinations; admin detail/download/deletion; saved rubrics; navigation and reload; payment-result recovery; and guest claiming. These browser API responses are mocked; real provider behavior was separately checked with the archived originals.
- Independent code review found and verified the PDF page-label regression fix, with no further introduced issues identified.

## Diagnostic cleanup

After verification, all three listed records and their archived originals were deleted from the live diagnostic store using the same storage helper as the admin “Delete record” action. Each subsequent detail read returned no record, and the failure inbox contained **0 records**. The temporary local image used for inspection was also removed. Other account data and saved grading results were not changed.

The bounded validation/retry approach follows the [official OpenAI guidance on JSON output validation](https://developers.openai.com/api/docs/guides/structured-outputs#json-mode).
