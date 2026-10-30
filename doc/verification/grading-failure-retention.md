# Failed grading originals and admin inbox

Implemented locally on October 29, 2026, following the user's selection of seven-day retention and request for an admin error list. Not yet deployed.

## Behavior

The grading route captures failures during file extraction, rubric structuring, AI evaluation, result validation and guest result persistence. Successful results, missing/invalid request inputs, authentication requirements, quota exhaustion and already-pending requests do not trigger capture. `next/server`'s `after()` schedules storage after the response, and collection errors never replace the grading error or interfere with reservation release.

Archives preserve the original submitted text (including whitespace), uploaded file bytes, any extracted text, rubric selection/instructions, grading mode/language, model names, deployment revision, request ID, error code and failing stage. Saved-rubric selections retain their text and ID; existing library files are not copied because they were not uploaded in that request. Cookies, credentials, raw IPs and entire HTTP requests are not archived. Collection is for troubleshooting, not model training.

The admin inbox is at `/admin` → **Grading failures**. It lists metadata in pages of 25, loads original text only when a record is opened, downloads files as attachments, and supports explicit early deletion. Metadata-only, expired, empty and unavailable states are shown. Inputs are rendered as plain text, never HTML. APIs authenticate every list/read/download/delete request and use `private, no-store` responses. Attachments use `application/octet-stream` and `nosniff`.

## Storage and limits

- Existing Upstash Redis; no new database schema, bucket or service.
- AES-256-GCM encryption for both metadata and original contents. HKDF derives a separate diagnostic key from the existing `ENTITLEMENT_SESSION_SECRET`. Record IDs and purpose bind the authenticated encryption. Rotating the session secret makes older diagnostics unreadable.
- Keys use `rubricheck:{grading-failures}`. Each record has a fixed seven-day expiry, applied before chunks are written. Only complete writes enter the inbox. Interrupted writes are removed best-effort and always expire; expiry is also checked before reads. Indexes contain record IDs and timestamps and are pruned during reads/writes and expire when inactive.
- Five original archives per account per hour, or keyed guest-IP group per hour. Further failures keep encrypted metadata without original content. Raw IPs are never persisted.
- A 64 MiB input budget counts submitted/extracted text and uploaded file bytes. Larger captures retain metadata only, with an explanation in the detail view. File contents are chunked to avoid oversized individual Redis commands.
- A storage outage or a process/platform termination before capture finishes can prevent archiving. This is best-effort diagnostic storage, not a guarantee that every infrastructure failure retains inputs. Past failures cannot be reconstructed.

## Support deletion

An admin can delete one record in the inbox. For an account deletion request, the authorized admin API also accepts `DELETE /api/admin/grading-failures` with JSON `{ "email": "account@example.com" }`. This removes that account's completed diagnostic records and originals. Request bodies should be used for email addresses, not URL query parameters. The existing account support deletion procedure must include this endpoint/helper alongside other account data stores. Guest records can be removed individually by request ID through the inbox.

## Verification

- Full unit/route suite: 222 tests passed. Tests cover failure-only capture, exact text and file preservation, encryption/tamper rejection, fixed expiry, partial-write cleanup, collection limits, pagination, per-record/account deletion, admin access, safe download headers, and capture failure isolation.
- Production build and changed-file lint passed.
- `scripts/check_grading_failures.mjs`: browser checks passed for list recovery, pagination, deferred original access, safe text rendering, exact file download, delete confirmation, metadata-only/expired records and mobile layout.
- `scripts/check_grading_errors.mjs`: all eight existing English/Korean error/retry checks passed.
- A live local HTTP smoke test submitted a synthetic corrupt PDF through `/api/evaluate`. The original 400 parsing error was preserved; the post-response task created an encrypted record in actual Redis; its TTL was verified near 604,800 seconds; authorized detail/file reads reproduced the exact original inputs; unauthorized reads returned 401; deletion removed the record and file contents. The synthetic account's diagnostic records were cleaned up afterward. No real customer records were modified, and no AI call or account evaluation charge was needed for this parsing-failure test.

The scheduler follows the [Next.js `after()` documentation](https://nextjs.org/docs/app/api-reference/functions/after). Unit expiry tests use a clock and Redis test double; the live smoke test verifies the actual Redis TTL configuration without waiting seven days.
