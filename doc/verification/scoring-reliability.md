# Scoring reliability and feedback access

## Behavior

- `rubric-sum-v2` adds criterion range endpoints, divides each sum by the rubric maximum, multiplies by 100, and rounds once. The +4 Standard bonus and -3 Strict penalty are removed. Neither criterion nor overall ranges are narrowed to a target width. Rubric bounds still apply.
- `score_calculation` reports the scoring version, mode, rubric total, endpoint sums, zero mode adjustment, and `uncalibrated_estimate` range kind. Point scores remain separate model estimates; overall ranges use endpoint sums, not point-score sums.
- Both narrow and wide ranges retain their endpoints in the result and share views. Equal endpoints display one number but remain explicitly labeled as an uncalibrated estimate.
- Mode changes are not revision gains. Compare only the same rubric, mode and scoring version, and account for model variability. Strict still uses its evidence requirements and conservative prompt; equal finalization inputs now produce equal totals.
- Legacy saved scores remain unchanged and receive a legacy-method explanation. Paying to unlock detail preserves scores, scoring provenance and summary; it supplies three generated improvement priorities.
- Free responses contain one priority, basic feedback and evidence. Top-up responses contain three priorities and detailed feedback. Only Pro contains rewrite suggestions. The same filter applies when reading old saved results. Existing free local snapshots containing three priorities are accepted for compatibility but still show only one.

## Evidence and limits

The historical `doc/growth/evidence/scoring-calculation.json` is retained. `scoring-calculation-v2.json` records the same synthetic 70-80 input after the change: both modes return 70-80; Free returns one priority. These files demonstrate arithmetic only, not AI accuracy or successful empirical calibration.

No paired human-grade evaluation dataset was found in the repository. Calibration remains **not established**. Removing unsupported offsets does not establish greater AI accuracy. No real model/teacher accuracy result is claimed.

## Run a human-grade audit

`npm run validate:scoring -- path/to/human-graded-holdout.json`

The JSON object must contain:

- `data_kind`: `human_graded_holdout`
- `source`: provenance for real human grading records
- `model_version`, `prompt_version`: exact versions used for these predictions (use separate datasets for different versions)
- `samples`: nonempty array of `{ id, human_grade_reference, mode, rubric, evaluation, human_score }`

`rubric` and `evaluation` must match the existing Rubric/Evaluation schemas; `evaluation` is the raw criterion-level evaluation, not the final API response. `human_score` is in original rubric points, from zero to the rubric total. `human_grade_reference` identifies the traceable grading record. Keep the task and its rubric together; use the same `id` for its Standard/Strict pair. Duplicate id/mode combinations are rejected. Strict requires evidence.

Use authorized, de-identified assignments with traceable teacher marks and matching rubrics. Reserve the holdout assignments before fitting or choosing any correction, keep revisions of an assignment in the same split, and record subject, level, rubric type and grader disagreement. Confirm data provenance manually: a JSON label alone cannot authenticate real grades.

The offline tool reports, separately by mode, sample count, midpoint mean absolute error (MAE), signed bias, observed range coverage and average width. It compares current sums against +4/-3 shifts applied to those same ranges to isolate the fixed offset. It does not reproduce the old width caps. It makes no network calls and enables no correction.

Before introducing a correction or confidence-level label, evaluate on independent held-out real grades, examine error and coverage by subject/level and rubric type, quantify sampling uncertainty and grader disagreement, and choose an explicit target coverage. A small dataset or observed coverage alone does not establish a calibrated confidence interval. Keep the result labeled uncalibrated until that work supports the claim.

## Regression checks

- `npm run test:all`: 97 passing tests covering arithmetic, access filtering, API responses, ownership, recovery, billing and existing unit/integration tests.
- `npm run test:recovery:browser`: 8 passing Chromium scenarios with mocked API browser flows including narrow-range display, free single-priority results, mobile overflow, restored files/text and checkout recovery.
- `npx tsc --noEmit`, production build and changed-file ESLint.

Browser/API tests use mocks for AI, Redis and billing. They do not establish production AI accuracy or exercise a real paid transaction. Repository-wide ESLint has pre-existing CommonJS import errors in the two growth audit scripts.
