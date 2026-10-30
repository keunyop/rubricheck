# Grading failure investigation — 2026-10-29

The reported feedback was: “every time I put grade my assignment it keeps saying something wrong”.

## Evidence and limits

- The matching feedback record was submitted at 2026-10-29 14:27:36 PDT (21:27:36 UTC).
- Production Vercel logs contain 12 `RUBRIC_STRUCTURE_FAILED` events between 14:05:55 and 14:26:10 PDT, before that feedback. The failures occurred in rubric structuring, before assignment evaluation. The logs also confirm reservation release on free attempts.
- The frontend did not map `RUBRIC_STRUCTURE_FAILED` or `EVALUATION_FAILED`, so both displayed “Something went wrong. Please try again.”
- The original rubric/model response is not available in those logs. Temporal correlation does not establish that every request belonged to the reporter or prove which underlying validation/model error affected their input.
- A separate live reproduction with synthetic input confirmed a defect: the model returned a valid single holistic criterion, but `RubricSchema` required at least two and rejected it. A two-criterion control succeeded with the same configured model.

## Changes

- Accept one or more rubric criteria. Empty criteria and nonpositive/nonfinite scores remain invalid.
- Accept both deserialized objects (Upstash's default) and JSON strings when reading the rubric cache. Previously valid object entries were treated as misses, forcing another model call.
- Separate model/service failures from rubric schema failures. Provider and JSON decoding failures return `RUBRIC_MODEL_UNAVAILABLE` (503); timeouts retain their existing handling. Failed attempts continue releasing usage reservations.
- Log validation issue codes/paths or a model failure category/status with the request ID, without logging rubric content or provider error bodies.
- Show localized, actionable rubric and evaluation error messages; preserve the existing temporary-service message for provider failures. Translated guidance uses the actual localized “No rubric” label.

## Verification

- Before the fix, the new single-criterion and deserialized-cache tests both failed.
- `npm run test:all`: 212 passed. The grade route test now exercises the real rubric parser/schema, instead of bypassing it with a stub. It verifies successful single-criterion grading, failure codes, reservation release, retry and paid-credit behavior.
- Following the final error-classification and translation edits, the affected parser tests (10) and localization tests (5) passed again.
- Live synthetic check: rubric structuring → actual AI evaluation → finalization succeeded with one criterion. It did not use an account quota or write to the production stores.
- `node scripts/check_grading_errors.mjs`: eight browser checks passed against a local production server in English and Korean. API responses are mocked; these checks cover error guidance, retained inputs, stable retry keys and rendering the successful single-criterion result.
- Production build and lint passed. The build required network access for the project's existing Google Fonts.

These changes are local and have not been deployed. After deployment, use the new `RUBRIC_SCHEMA_VALIDATION_FAILED` and `RUBRIC_MODEL_CALL_FAILED` diagnostics to distinguish any remaining production failures.
