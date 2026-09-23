# Actual scores and comments

## User flow and data

Open a saved assignment from Recents, search, or a project, then choose **Add actual score and comments**.
A numeric score and maximum, a comment, or both can be saved. Zero and fractional scores are supported.
Course, assignment type, and whether the graded submission matches the checked draft provide context.
Saved records can be edited or deleted without deleting the original evaluation or consuming a check.

Personal record storage requires its own explicit checkbox. Internal quality validation and anonymized
public case use are independent, optional, unchecked permissions. Either can be withdrawn by editing
and saving. Deletion removes the record and both permissions. The consent text version, last choice
change time, record revision, and record creation/update times are stored. Comments are plain text;
these fields are excluded from evaluation image capture and browser result snapshots.

The owner comes only from the verified session. The separate endpoint is
`/api/workspace/assignments/[id]/actual-result` (GET, PUT, DELETE). It requires an account-owned,
persistently archived evaluation; expired results that were never archived cannot be reconstructed.
The client loads the record on demand. Errors preserve the editable input, and concurrent edits use
a revision check so a stale tab cannot silently restore revoked permission. On conflict, explicitly
reload the saved record before retrying.

Storage uses the existing Redis configuration, without SQL migrations or new environment variables:
`rubricheck:workspace:{ownerHash}:result:<evaluationId>:actual`.
There is no automatic expiry. Account deletion must remove these keys along with the workspace,
archived evaluations, and other account data. No duplicate global/public consent index is maintained.
Reopening a result, upgrading feedback, changing projects, and deleting projects preserve actual results.

## Comparison and provenance

The actual percentage is `score / maximum * 100`. The UI shows the original AI range, actual
percentage, actual-minus-midpoint difference in percentage points, inclusive range membership, and
distance outside the range. The midpoint is explicitly a reference, not an additional model prediction.
Machine-precision noise is tolerated at range boundaries; displayed rounding does not decide coverage.
Comments alone show no numeric comparison. Revised or unconfirmed drafts carry a comparison caveat.

The range, grading mode, scoring version and available provenance are copied from the server archive
at the first actual-result save, and retained on subsequent edits. Client-supplied estimates are rejected.
New account evaluations and claimable guest evaluations carry the configured model identifier,
a SHA-256 fingerprint of the prompt template for its mode/detail level, and an input fingerprint.
Legacy metadata stays unknown instead of being assigned today's model. The input fingerprint is
derived from rubric and assignment text; no additional permanent copy of raw inputs is created.
Model aliases identify the configured model, not a provider-guaranteed immutable model revision.

## Quality and public use

`analyzeActualResults` is an offline descriptive helper. Supply only current records from one account
at a time. It uses the latest revision of each evaluation, only quality-consented numeric grades,
and only submissions confirmed to match the checked draft. Public-case permission alone never
authorizes this analysis. Current revocations/deletions must be applied before any export or analysis;
do not treat old downloaded consent snapshots as authorization.

Metrics are separated by assignment type, grading mode, scoring version, model and prompt template:
observation count, midpoint MAE, signed actual-minus-midpoint bias, observed range inclusion rate,
and average range width. Counts distinguish known input fingerprints from observations without
comparable provenance. Repeated-run variation is the mean midpoint spread over groups of two or more
checks with identical input fingerprints and versions and the same normalized human grade. Revised
drafts, different modes/versions, conflicting human grades and unknown provenance are not repeated runs.
Each evaluation is an observation, so repeated checks are not independent assignments; do not use
observation count as an independent sample size. No repeats yields null, not zero variation.

All metrics remain descriptive, self-reported and uncalibrated. Include misses alongside useful
estimates. Do not market accuracy using a correlation coefficient or selected successful cases.
Small samples are context, not a reason to automatically correct scores. There is no automatic
publication, model adjustment or public dataset endpoint. Future publication must recheck the current
public permission, remove identifying information from all excerpts, review both hits and misses,
and handle later withdrawal from the controlled publication surfaces.

Before changing models, prompts or calibration, use separately held-out, authorized grading tasks,
keeping all revisions/repeats of an assignment in the same split. Compare error, coverage, width and
repeat variability by assignment type and version. The existing
`npm run validate:scoring -- <human-graded-holdout.json>` workflow remains available; see
[scoring reliability](scoring-reliability.md). User submissions are not automatically a holdout set.

## Verification

- `npm run test:all`: includes input boundaries, independent choices, account isolation, immutable
  estimates, stale writes, consent withdrawal, deletion, unavailable storage, provenance and metrics.
  The runner escapes literal brackets so dynamic route tests are included on Windows.
- `npm run test:actual-results:browser`: local Chromium checks save/reload/edit, score conversion,
  independent permissions and withdrawal, invalid/zero/fractional scores, failed read/save recovery,
  conflict reload, switching assignments, plain-text comments, deletion, mobile width and logout.
- Existing workspace, guest-trial, recovery, rubric-library and feedback browser checks should also pass.
- TypeScript, changed-file ESLint, and a production build cover integration.

Browser/API tests replace network services with fixtures; they do not test a real Redis deployment,
billing transaction or AI accuracy. Browser checks support `TEST_BASE_URL` (local hosts only) and
`PLAYWRIGHT_MODULE` for an existing Playwright installation.

### Completed checks (2026-09-22)

- All 144 unit/API tests passed, including dynamic route tests.
- Actual-result browser scenarios passed on both development and production builds.
- Workspace, recovery, guest-trial, rubric-library and feedback browser scripts passed.
  Feedback admin checks used a local server with `ADMIN_SECRET=local-feedback-browser-test`
  (the script's default test cookie); no deployed service was changed.
- TypeScript, changed-file ESLint, whitespace checks and the final production build passed.
- Regression testing exposed a pre-existing rubric dialog focus issue under React Strict Mode.
  Closing the dialog before restoring the opener's focus fixes the existing keyboard test.
