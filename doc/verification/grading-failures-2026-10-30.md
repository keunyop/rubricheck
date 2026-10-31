# Grading failure repairs — October 30, 2026

These changes are local and have not been deployed. No customer credits, evaluation quotas, saved results, or diagnostic archives were modified during reproduction. Original inputs were processed in memory, using the existing providers after the user explicitly authorized the replay. Customer documents are not included in fixtures or this report.

## Reproduction and causes

| Failure record | Original failure | Evidence |
| --- | --- | --- |
| `2e5dd3b4-32e6-4aed-b41a-610669f444c7` | PDF extraction | Valid two-page scan; the native parser returned only four newline characters. |
| `218faf15-e758-46e9-b05e-53784b8e603b` | PDF extraction | The PDF bytes were identical to the first record; another attempt failed on the same missing OCR path. |
| `b1243eab-37a2-46cd-8acb-23bbfb7dc2ec` | Evaluation validation | Production logs rejected a negative criterion score. Replaying the original inputs and earlier prompt reproduced a `-5` score. The structurer had expanded a 100-point rubric into 17 criteria totaling 157 by treating deductions, bonuses, and supporting instructions as additional scoring categories. |

The first two requests occurred at 15:42 PDT and the third at 16:27 PDT on October 30. Production log request IDs matched the archived records.

## Repairs

- PDF extraction preserves native text and falls back to Google Vision for scanned/unreadable-text pages. Mixed documents retain page order. Explicit batches cover more than five pages without silently dropping the remainder; incomplete/error responses fail instead of returning a partial grade. A shared 60-second deadline bounds OCR. OCR outages retain the service-error classification. The parser uses a plain `Uint8Array` to avoid the bundled PDF.js reader's incompatible `Buffer.slice()` behavior, also reproduced with a synthetic native-text PDF.
- Rubrics retain base scoring categories and their stated total. Explicit deductions and bonuses have separate names, conditions, directions, and positive maximum point magnitudes. Base weights must match a supplied total. Supporting requirements belong in base descriptions, and proof conditions for academic-integrity penalties are preserved.
- Evaluation returns adjustment magnitudes separately. The server checks names, counts, duplicates, sign and limits, applies each signed adjustment once, and leaves the base denominator unchanged. Final percentages remain bounded to 0–100. Invalid model output gets one re-evaluation within the original AI deadline; persistent invalid output is rejected rather than replaced with invented scores. Provider bodies and student text are excluded from diagnostic logs.
- Adjusted results use `rubric-sum-v3`, show adjustment reasons on desktop/mobile, and explain the arithmetic. Ordinary results retain `rubric-sum-v2`. Translation preserves adjustment names, points and evidence. Paid detail upgrades preserve the original scoring through the existing merge path.
- Cache version `v2` avoids reusing old extraction results. Previously saved library rubrics are restructured on their next grading request and refreshed only after successful grading. Their original text and file bytes remain intact.

## Verification

- All three archived input sets completed real extraction, structuring, evaluation, and finalization with the repaired code. The two scanned PDF attempts each extracted 2,617 characters. The third produced exactly six base criteria totaling 100 and seven separate adjustment rules, with no negative criterion scores.
- A synthetic scan also passed actual Google Vision OCR, then Standard and Strict AI grading. These checks bypassed account billing and result persistence.
- The full unit/route suite passed: **272 tests**, including free/paid reservation settlement, retries, refunds, guest evaluation, saved rubrics, result recovery, translation, adjustment arithmetic, OCR batching and failures, and original AI deadline enforcement.
- A live Redis test created a uniquely named synthetic rubric, refreshed its structure/version, and verified byte-for-byte original-file preservation. The synthetic record was deleted afterward.
- Final production build (including TypeScript), changed-file lint, and `git diff --check` passed.
- Six browser suites passed against the local production build: `check_grading_errors`, `check_grading_failures`, `check_rubric_input_recovery`, `check_rubric_library`, `check_evaluation_recovery`, and `check_guest_trial`. They cover English/Korean error recovery and adjustment display, mobile layout, all 12 English/Korean/Malay text/file input combinations, admin diagnostics, saved rubrics, navigation/reload, payment-result recovery, and guest preview claiming. Browser API responses are mocked; actual provider calls were separately verified using the original inputs above. Browser checks produced no uncaught page errors.

AI scores remain estimates and can vary across calls. These tests verify the reported failures and relevant regression paths; they do not establish agreement with a human grader or guarantee external-provider availability.

## References

- [Google Vision synchronous file annotation](https://docs.cloud.google.com/vision/docs/file-small-batch): explicit page selection and the five-page per-request limit.
- [OpenAI output validation guidance](https://developers.openai.com/api/docs/guides/structured-outputs#json-mode): valid JSON alone does not guarantee schema validity; validation and recovery are necessary.
