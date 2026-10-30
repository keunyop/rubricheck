# Rubric input recovery — October 30, 2026

## Reported request and root cause

Request `a67a1e1f-7471-4e69-a581-7f2da002bfbd` corresponds to retained archive
`f59a9d5a-3685-4967-a626-60cb8fd7eabc`, created at 06:17:26 PDT (13:17:26 UTC).
The deployment was commit `9bbe76562b70ed997a20a0ea32b5d772f9a7cdf6`.

The rubric text contained a student essay; the assignment screenshot contained
instructions for writing an introduction. The fields were reversed. File
extraction completed successfully (1,193 rubric characters and 493 assignment
characters). The model returned an empty criteria list for the essay. Production
logs show `RUBRIC_SCHEMA_VALIDATION_FAILED`, `too_small` at `criteria`, followed
by `EVALUATION_RESERVATION_RELEASED` for free usage and `RUBRIC_STRUCTURE_FAILED`.

With the user's explicit approval, the original extracted text was replayed
through the existing configured model (`gpt-6-luna`), without account billing,
production cache access or result storage. The unmodified code reproduced the
same empty criteria failure. Reversing the inputs allowed criteria extraction.
This is a separate issue from the earlier Google Vision credential incident.

## Changes

- A well-formed empty criteria list now returns `400 RUBRIC_CRITERIA_NOT_FOUND`
  with a rubric-field hint. Invalid schemas, scores, provider errors and timeouts
  retain their existing technical error classifications.
- The prompt explicitly accepts assessment instructions without points, and
  forbids inventing grading criteria from essay topics, headings or citations.
  The nonempty rubric schema is unchanged. Empty criteria are never evaluated or
  cached, and the service does not silently substitute a general rubric.
- The UI explains that the fields may be reversed, suggests assessment
  instructions or the existing No rubric mode, and offers an explicit swap
  button for file/text inputs. Modes, text, file bytes and file order are
  exchanged together. Swapping does not start grading. General/library modes
  do not offer the button. All seven interface languages have the new guidance.
- Free and paid reservations are released, and a guest preview remains available
  for a corrected retry. This input validation does not create another diagnostic
  archive containing student originals; the existing incident archive is retained.

Prompt guidance was checked against the [official OpenAI prompt engineering
documentation](https://developers.openai.com/api/docs/guides/prompt-engineering).
No model, SDK or database changes were made.

## Verification

The regression test failed before the change: it received `RUBRIC_STRUCTURE_FAILED`
instead of the expected input-specific code. After the change, the same original
essay returned `RUBRIC_CRITERIA_NOT_FOUND`. Correcting the field positions and
running the actual rubric model, evaluation model and finalizer succeeded, with
four criteria and a valid score range. These model outputs can vary across runs.
This was an isolated replay of retained extracted text, not a new OCR request or
a production customer evaluation.

- Full unit/route suite: **246 passed**. This includes existing OCR, scoring,
  Standard/Strict, saved/general rubric, recovery, usage and billing regressions.
- Final grade/guest route rerun: **39 passed**, including free allowance release,
  purchased-credit refund, no AI evaluation/no duplicate diagnostic archive for
  missing criteria, and a successful corrected retry.
- Browser recovery: **12 scenarios passed** (English/Korean/Malay × text/file,
  file/text, text/text, file/file). They verify explicit swapping, no automatic
  submission, file bytes/order, new idempotency keys, reload persistence and final
  success. Korean scenarios also check mobile layout. These use synthetic inputs
  and mocked API responses, not real customer accounts.
- Existing error/retry browser checks: **10 passed**; technical errors do not
  offer the swap action. Admin failure inbox checks: **5 passed**.
- Production build with TypeScript, changed-file ESLint and diff whitespace
  checks passed. The final build includes the corrected optional diagnostic code.
- Retained incident data in Redis was not changed. Temporary local originals,
  extracted/model content and generated grading results were removed after testing.

Release status: local changes only; not committed or deployed by this task.
