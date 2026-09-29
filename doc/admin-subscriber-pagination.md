# Admin subscriber pagination

## Deployment

Apply `supabase/admin_dashboard.sql` in the Supabase SQL Editor **before deploying the application**. The existing billing schema (`supabase/credits_mvp.sql`) must already be installed. This additive script can be reapplied and does not modify subscriber data. Do not rerun the base billing schema on an existing deployment.

The new RPC is restricted to `service_role`. The existing admin API authorization still runs before querying it. No environment variables are added. Without the SQL function, the dashboard API returns an error; it does not fall back to downloading all users.

## Behavior

- `GET /api/admin/dashboard?page=1&pageSize=25&q=...` returns one page and pagination metadata.
- Default size: 25; UI choices: 25, 50, 100; API maximum: 100.
- Search covers email, customer ID, plan and subscription status across all subscribers, using a literal, case insensitive substring.
- Search and page size changes start at page 1. Search requests wait 300 ms after typing. Superseded requests are canceled.
- Out of range pages clamp to the final page. Empty results return page 1 of 1.
- Summary cards always cover all known users, independent of search and pagination.
- Sorting uses Pro, Top-up, Free, then latest top-up/update and identity as a stable tie breaker.
- Emails are normalized and email/customer credit records are merged before pagination. Subscription emails take precedence over payment identities; otherwise the most recent payment supplies the email. If several subscriptions share an email, the most recently updated subscription supplies its status and period end.
- Refresh and credit adjustments reload the current search and page.

The database still aggregates the source tables to compute exact global totals and subscriber identities. The application no longer downloads all four source tables, sorts all users in JavaScript, or sends the entire roster to the browser. The former 50,000-row reader limit no longer truncates the roster.

## Verification

- `node --import ./scripts/register-test-resolver.mjs --test --experimental-strip-types src/lib/adminDashboard.test.ts`
- On an empty disposable PostgreSQL database with the Supabase roles, apply `credits_mvp.sql`, then `admin_dashboard.sql`, then run `psql -v ON_ERROR_STOP=1 -f supabase/admin_dashboard.test.sql`. Fixtures roll back. Tests cover identity merging, credits, summary totals, stable pages, search, empty results, bounds, permissions and more than 50,000 source rows.
- Start a local development server with `ADMIN_SECRET=local-admin-pagination-test`, then run `node scripts/check_admin_pagination.mjs`. Default URL: `http://127.0.0.1:3108`; override with `TEST_BASE_URL` and `TEST_ADMIN_SECRET`. The browser uses mocked API data.
