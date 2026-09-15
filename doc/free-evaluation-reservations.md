# Free evaluation reservations

## Deployment

1. Apply `supabase/credits_mvp.sql` for a new database only.
2. Apply `supabase/free_evaluate_reservations.sql` before deploying this application version.
3. Drain old evaluation requests during the rollout. Old application versions still use immediate consumption and do not account for reservations.

The migration preserves existing counters. It cannot distinguish historical successes from historical failures, so it does not refund past usage automatically. Do not rerun the base schema after the migration: it replaces the summary function with the legacy implementation.

## Behavior

- Parsing and strict-mode access validation happen before a reservation.
- `free_usage_counters.evaluate_count` contains confirmed usage. Account summaries also count active reservations when calculating availability.
- Each account is locked while reserving or settling. Pending requests cannot exceed the trial limit or cause an automatic paid-credit fallback while free slots are held.
- A validated evaluation confirms its reservation once. Structuring, evaluation and finalization failures release it. Repeated settlement and late refunds cannot change another attempt or refund a successful evaluation.
- Browser retries retain the idempotency key until inputs change or an evaluation completes. The API scopes it to the account and parsed inputs. Duplicate pending/completed requests return 409 without consuming another free use or purchased credit. A completed duplicate asks the user to check the saved result or explicitly submit a new evaluation; it does not replay the result. Clients calling the API directly should retain their `Idempotency-Key` when retrying.
- Abandoned reservations stop occupying quota after 30 minutes, without a scheduled cleanup job. This covers the two model calls, each of which permits a configured timeout up to 10 minutes. The next reservation marks expired holds as released.
- Confirmation is retried once with the same reservation ID. If storage remains unavailable, the valid result is still delivered and the incident is logged; an unconfirmed reservation eventually expires. Result recovery outages also preserve the successful response.
- Purchased-credit and Pro behavior is preserved. Error response headers reflect a successful free or credit refund.

## Observability

Use `requestId`, `stage`, and `billingSource` in server logs:

- `EVALUATION_RESERVATION_RELEASED`: failed processing whose reservation was released.
- `EVALUATION_RESERVATION_RELEASE_FAILED`: failed release; free reservations retain the expiry safeguard.
- `EVALUATION_RESERVATION_CONFIRM_FAILED`: both confirmation attempts failed.
- `GRADE_REQUEST_FAILED` with `stage=file_parsing`: failure before any reservation.
- Existing `RUBRIC_STRUCTURE_FAILED` and `EVALUATION_FAILED` describe model failures.

Filter release events to `billingSource=free` and group by request ID to measure affected evaluations. Timeout paths also emit release events. Compare with evaluation request telemetry for a rate. Production occurrence frequency has not been measured as part of this local implementation.

## Verification

- `npm run test:all`: API, settlement adapter and existing regression tests (Node 24 supports the module mocks used by API tests).
- `npx tsc --noEmit` and `npm run build`.
- Against a disposable local PostgreSQL database, apply both schema files, then run `psql -v ON_ERROR_STOP=1 -f supabase/free_evaluate_reservations.test.sql`. This test rolls back its data.
- Set `PGHOST=127.0.0.1`, `PGPORT`, `PGUSER` and `PGDATABASE` for that disposable database, then run `node scripts/test_free_usage_concurrency.mjs`. It opens concurrent connections and removes its uniquely named test account afterward. `PSQL_BIN` can override the executable path.
