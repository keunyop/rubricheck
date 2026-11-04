# Quiz implementation and verification

Implemented from [quiz-feature-spec.md](../../quiz-feature-spec.md) on 2026-11-03.

The flow is: grading result or personal materials → authenticated source selection
→ persistent generation job → validated quiz → saved practice and mistake review.

## Implementation

- `app/quizzes`: private library, creation, practice, results, history, rename/move/delete.
- `app/api/quizzes`: authenticated generation, reads, edits, reports and study attempts.
- `app/api/quizzes/sources`: owned text/assignment sources and chunked file ingestion.
- `lib/quizParse.ts`: scoped extraction with real PDF page numbers, presentation slide
  order, paragraph references and existing image/PDF OCR. Unreadable selected units
  fail visibly; excluded units are never substituted into generation.
- `src/lib/quizStore.ts`: account-owned Redis transactions for jobs, reservations,
  quota settlement, immutable answers, attempt revisions and scoped erasure.
- `src/lib/quizGeneration.ts`: grounded generation followed by independent review.
- `app/ai-quiz-generator`: public server-rendered seven-language introduction,
  prepared samples, metadata, canonical/hreflang and static sharing image.
- Sidebar, grading/guest result, home/product, pricing, help, related guides and
  retention notice expose the feature consistently.

## Data and billing

The existing Redis deployment stores account records at
`rubricheck:quiz:{hashed-email}`. Durable fields contain quizzes (`q:`), generation
jobs (`j:`), attempts (`t:`), reports (`r:`), lifetime free usage and the active job.
Sources live under `:source:<id>` with a Redis TTL. Long-lived references retain
names, ranges and timestamps, not original source text or evidence quotations.

Generation reserves the requested free count atomically. A single commit saves
the quiz and charges its actual accepted count. Duplicate request IDs return the
original job; changed payloads conflict. One job per account, worker tokens and
five-minute leases prevent duplicate completion. The library or next mutation
sweeps interrupted jobs and releases their reservations. Reusing a quiz is free.
Pro generation does not increment free usage. The existing account entitlement
resolver covers monthly, annual and lifetime Pro; grading credits are untouched.

New extracted materials expire after 24 hours. Original assignments preserve the
existing recovery deadline and must still be available to generate. Raw upload
chunks expire after one hour and are removed after successful extraction. Saved
questions, explanations and attempts survive source expiry and Pro expiry.

Deleting a project detaches its quizzes. Deleting a quiz removes its questions,
attempts and reports but preserves usage and generation receipts. Account erasure
uses `deleteQuizAccountData(email)` in the existing support-driven deletion process,
after account access is stopped. It deletes the whole isolated quiz namespace.
There is no new database migration, service, public sharing or payment flow.

## Verification evidence

| Boundary | Evidence |
| --- | --- |
| Core and regression tests | `node scripts/run_all_tests.mjs`: 302 passed, 0 failed |
| Production compilation | `next build`: successful, including TypeScript and generated routes |
| Source handling | PDF page selection, DOCX/TXT paragraphs, reordered PPTX slides, size/range failures |
| API access | Guest requests rejected before parsing/storage; owner isolation; original expiry; idempotent replay after expiry |
| Atomic persistence | Live Redis test: 12 simultaneous requests, one accepted; partial/duplicate settlement; failure release; stale worker fencing |
| Practice persistence | Live Redis and HTTP tests: confirmed answers, revisions, reload, wrong/unanswered review, independent full score |
| Real AI generation | Four Korean geometry questions passed generation and independent review; citations, explanations and MCQ/O/X answers manually checked |
| Full server flow | Live local production HTTP test: multi-chunk upload, selected paragraph extraction, two actual AI questions, `after()` processing, quota, saved answers, expiry, ownership, replay and deletion |
| Browser behavior | [Browser results](results.json): login return with selected guest assignment, creation, save failure/retry, answer locking, reload, review after source expiry, renamed/detached quiz reuse |
| Localization and public SEO | Seven public server-rendered locales with canonical/hreflang/sitemap; keyboard-operated examples; seven private creation/review screens; Urdu RTL; no private sitemap entries |
| Visual review | 390px creation/review and 1440px library screenshots inspected; mobile footer no longer obscures content |

The browser suite uses fixture responses for private APIs so it can test specific
failures predictably. The Redis, model and HTTP integration scripts use real
configured services with fresh `@test.invalid` accounts and synthetic documents;
their `finally` blocks delete the test namespaces. No production deployment or
real-user content is part of these tests.

Existing OCR integration is reused. This change's live sample checks use native
text, and do not establish OCR accuracy for every scan or document language.
Image-only PPTX slides require readable replacement text; the UI reports the
unreadable source instead of silently omitting it.

## Reproduce

Run `npm run test:all`, `npm run build`, and the commands in the repository
[README](../../../README.md#private-study-quizzes).

For the full HTTP integration, run the built local server with
`ENTITLEMENT_SESSION_SECRET=local-quiz-browser-test-only`, then:

```powershell
$env:QUIZ_HTTP_TEST='1'
$env:TEST_BASE_URL='http://127.0.0.1:3217'
node --env-file=.env.local --import ./scripts/register-test-resolver.mjs --experimental-strip-types scripts/test_quiz_http.ts
```

This opt-in test calls the configured model for up to two questions. It accepts
only a localhost target. The local server needs the existing Redis, entitlement
and model environment configuration. Never use the test session secret in a
deployed environment.

Generation counts, failures and reports are durable operational records. Post-launch
cost analysis, conversion measurement and model-quality sampling remain operational
follow-up under the existing analytics consent policy; this implementation does
not enable analytics collection or introduce a hidden Pro monthly limit.
