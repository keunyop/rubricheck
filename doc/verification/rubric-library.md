# Rubric library and grading without a rubric

Verified locally on September 21, 2026: all 138 unit/API tests passed, production
build passed, changed-file lint passed, and SEO checks passed for 13 public pages.
The new rubric browser suite and existing workspace, recovery, guest-trial, and
feedback browser suites passed. Desktop and mobile screenshots were inspected.
Browser/API checks use isolated mocks; no production AI or billing calls were made.

The rubric input now has **My rubrics** and **No rubric**. The library lists the
signed-in account's 50 most recently used rubrics, supports renaming and removal,
and downloads every original file, including multi-image rubrics. Successful
signed-in evaluations save new rubrics automatically; selecting an existing
rubric reuses its structured criteria and preserves its edited name.

The existing seven-day structuring cache remains separate. Existing evaluations
from before this feature cannot supply original uploads because those files
were not archived. General criteria and guest previews are not saved to the library.

## Storage and access

No migration or new environment variables are required. Storage uses the existing
Upstash Redis configuration. Library keys are `rubricheck:rubrics:{SHA256(email)}`
and their associated `:data:` hashes. The email comes from the verified session.
List responses contain metadata only; text/criteria and original file chunks are
separate. Files use 192 KiB chunks, avoiding a single large Redis request.

Staging records expire after one hour. Only complete records are published.
Deduplication, recency, rename, deletion, and eviction use atomic operations.
The 50 most recent entries have no time-based expiry. Removing or evicting an
entry deletes its source data. Account deletion must remove the library metadata,
data hashes, and any staging hashes in addition to the existing account records.

A library write failure cannot invalidate a successful evaluation or refund a
successful check. The response includes `x-rubric-library-unavailable: 1` and the
UI explains that the rubric was not saved. An unavailable saved rubric fails
before any usage reservation. Downloads require the owning session and use
attachment headers, no-store, and nosniff.

## General grading

Requests default to the existing provided-rubric path. Both JSON and multipart
requests accept `rubricSource: general`, or `rubricSource: saved` with `rubricId`.
Mixed sources and missing rubric inputs are rejected. General mode optionally
accepts `assignmentInstructions` (5,000 characters).

General criteria total 100: task/focus 25, reasoning/understanding 25,
evidence/support 20, organization 15, clarity/mechanics 15. Structuring is skipped.
Instructions are assessment context, not evaluator commands. Existing grading
modes, limits, credit reservations, feedback restrictions, guest previews, and
result recovery remain in use. Results retain a General criteria label, including
after upgrading feedback.

## Entry points and validation

The existing six guide pages offer direct starts with general criteria or saved
rubrics. The essay guide explains the new workflow. No new SEO pages were added.
Draft restoration includes saved selections and instructions.

- `npm run test:all`: unit/API coverage, account isolation, file bytes, duplicate
  reuse, recency, rename, removal, retention limits, outages, and grading modes.
- `npm run build`, `npm run test:seo`, and lint on changed source files.
- `npm run test:rubrics:browser`: desktop/mobile library, original download,
  input restoration, general grading, account changes, keyboard focus, and all
  six guide entry points.
- Existing workspace, recovery, guest-trial, and feedback browser scripts.

Browser tests mock APIs and never call paid AI or payment services. Set
`TEST_BASE_URL` to a local production server and `PLAYWRIGHT_MODULE` when Playwright
is installed outside the repository. The feedback browser check requires the local
server's `ADMIN_SECRET` to match `TEST_ADMIN_SECRET` (default
`local-feedback-browser-test`).

The repository-wide lint command also scans the existing CommonJS audit scripts
in `doc/growth`, which currently trigger six no-require-imports errors. Those scripts
are outside this feature's changes.
