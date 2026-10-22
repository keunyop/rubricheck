# RubriCheck revenue baseline and growth changes

RubriCheck has a usable paid product and existing SEO traffic, but historical traffic cannot yet be connected to paying customers. This change prepares consent-based funnel measurement, authoritative payment reporting, and one reversible Credits-versus-Pro presentation experiment. It changes no prices, free limits, credit quantities, subscriptions, or entitlements. No production migration, deployment, billing configuration change, or customer outreach was performed.

## A Verified baseline

The database snapshot was taken **October 22, 2026 at 10:57:45 America/Vancouver** (17:57:45 UTC). October means **October 1 at 00:00 PDT through this snapshot**, not a full month. Sources: read-only aggregate queries against the RubriCheck Supabase project, [saved results](evidence/2026-10-22-revenue-baseline.json), [reusable SQL](revenue-baseline.sql), repository billing configuration, and the owner's October 22 figures. No customer identifiers or assignment content are included in these artifacts.

| Metric | Evidence and reconciliation |
|---|---|
| Active paid subscribers | Owner: 16. DB: 17 rows marked active Pro, **16 with future expiry**; 8 canceled rows, one with future expiry. The 16 is consistent with the owner's count, but entitlement rows are not a Stripe subscription/payment census. |
| Subscription MRR | Owner: **$89.88**, currency not specified. Not independently verified. Local Stripe credentials are test mode and were excluded. DB entitlements contain neither actual prices nor billing intervals or discounts. |
| ARR | Owner-implied annualized run rate: **$1,078.56**, same unspecified currency, not verified annual cash revenue. No Lifetime or credit proceeds should enter this number. |
| October new / canceled subscriptions | Owner: 6 / 1, implying net +5 if definitions and cohorts match. Not verifiable from the current DB snapshot: `updated_at` is not subscription start or cancellation time. |
| October credit purchases | **1 live Checkout record, 1 purchaser, CAD $4.99 gross**, followed by **CAD $4.99 refund for all 10 credits** on October 5 PDT. **CAD $0 net**. Owner's net revenue is consistent; zero purchasers and zero refunds are not consistent with the ledger. A live-mode record can still be an owner QA purchase; customer-versus-owner status is not inferred. |
| All-time recorded credit sales | 7 live purchases of the 10-pack, CAD $34.93 gross, 5 purchaser identities. Three additional legacy rows have no amount/currency; they are not counted as paid revenue. |
| October observed free usage | **91 succeeded reservations across 63 actors**, or **1.44 successful reservations per active free actor**; 8 released reservations across 3 actors. Coverage began September 15. Releases are not all voluntary abandonment or necessarily all failures. |
| October observed credit usage | **5 non-refunded usage events across 2 actors**, or **2.5 per active credit actor**. Spending old credits does not imply an October purchase. |
| Pro / guest usage and overall average | Not reconstructible from these ledgers. The owner-reported average of 3 cannot be reconciled without a consistent active-user denominator and complete Pro/guest success records. Workspace metadata has no historical billing tier; reading archived assignment feedback is unnecessary for this audit. |
| AI and document-processing cost | Owner: **$0.77 October to date**, currency not specified. No invoice/usage export or cost ledger was available. Model configuration and API keys do not establish actual cost. Do not annualize or treat this as a full-month expense. |
| Stripe fees | Owner: $0.06 per subscription payment. Actual processing, Billing, cross-border, FX and other fees are unverified. The $0.06 must not be treated as an all-in charge. |
| Contribution profit | Unavailable. Known October credit gross less refunds is CAD $0 **before** unverified fees and processing costs. Subscription cash receipts, tax, discounts, complete refunds, fees and variable costs are missing. |

No dated entitlement has the far-future expiry used by the repository's Lifetime policy, but this does not prove there have been no Lifetime purchases or refunds. Historical acquisition for the existing paid base remains **unknown**.

For a live Stripe reconciliation, obtain read-only access to subscriptions with expanded item prices and discounts, paid invoices and billing reasons, Checkout/PaymentIntent records, refunds, and balance transactions with fee details. Report currencies separately. For each active recurring item, normalize its net recurring amount and quantity by interval: monthly / interval count; annual / (12 × interval count). Separate trialing, past_due, paused, unpaid and canceled statuses; report scheduled cancellations separately from ended access. State whether temporary/once-only coupons enter MRR. Sum unrounded normalized values before display rounding, then ARR = 12 × MRR. One-time credit/Lifetime payments contribute cash revenue, never MRR. Stripe's [Billing analytics](https://docs.stripe.com/billing/subscriptions/analytics) and [balance transaction reporting](https://docs.stripe.com/reports/balance-transaction-types) describe the authoritative sources.

## B Work completed

### Measurement and privacy

The existing GA4 property (`G-S7M12R54DP`), Vercel Analytics and Speed Insights were found; no GA4 custom funnel events or first/last-touch records were present. Existing anti-abuse telemetry is short-lived operational data, not a conversion cohort. The new server-only Supabase tables reuse existing REST helpers, signed login sessions, Stripe webhook verification and administrator authorization.

| Concept | Implementation |
|---|---|
| Page and pricing views | Consent-gated first-party events; clean public path allowlist. Existing Vercel tools remain consent-gated. GA4 manual page views require the explicit rollout setting below. |
| Evaluation start and outcome | Server grading wrapper records starts, successful guest previews, completed evaluations and classified failures. Each server attempt has its own ID; a result view must match a successful server event. No rubric, assignment, filename, score or feedback is recorded. |
| Signup | Successful OTP verification records the first verified account without a prior usage/billing footprint. Historic unused logins leave no registry, so this is a **signup proxy**, not a fully reconstructed account creation date. Returning accounts and later visits remain distinct. |
| Guest to account | A signed 90-day visitor cookie links an opted-in guest to the verified account. Cookie rotation on verification/logout and ambiguity checks prevent cross-account merges on shared browsers. |
| Checkout | Recorded when Stripe returns a usable session, deduplicated by session. Product and opaque account metadata propagate to the subscription or PaymentIntent; retries retain metadata. |
| Purchase | Paid one-time Checkout events deduplicate by PaymentIntent. Recurring payments come from `invoice.payment_succeeded`, keyed by invoice. Initial subscription invoices, renewals, changes, credits and Lifetime are distinct. One-time payment dates use the successful event time, not Checkout creation time. Cancellations are ended subscriptions; refunds deduplicate by refund ID. |
| First payer | Known prior payers are excluded. Unknown history is reported separately; it never becomes a guessed first customer. First payment dates handle out-of-order webhook delivery. |
| Acquisition | First observed and last observed touches, reviewed UTM source/medium/campaign values, public landing path, coarse referrer domain/category and trusted Vercel country. Unknown/free-text values are discarded. Historical payer acquisition stays unknown. |
| Administration | Existing `/admin` includes an on-demand growth panel; `/api/admin/growth` returns aggregates only with existing admin authorization and `private, no-store`. Unavailable storage is not displayed as a zero baseline. |

Optional measurement is off until consent; DNT/GPC override consent. Account/email identifiers become keyed pseudonyms only on the server; opaque Stripe transaction IDs use stable SHA-256 deduplication keys that survive identity-secret rotation. These pseudonyms remain sensitive and are never sent to GA4/Vercel or returned in the admin aggregate API. The browser event endpoint validates same-origin requests, bounds body size, restricts names and properties, rate-limits through existing Redis and rejects fabricated purchase events. Operational event writes fail open with a short timeout and waiting for browser analytics is capped at 1.5 seconds; payment reporting failures request Stripe retries after existing billing effects. The production flag defaults off until the migration is approved.

Journey events have a 90-day retention window; the payment reporting ledger has 400 days with its acquisition snapshot removed after 90 days. Account attribution is cleared after 90 days of inactivity, and account reporting records after 400 inactive days. Daily pruning can add up to 24 hours before physical deletion. The migration includes pruning and opt-out functions. **Schedule pruning before enabling collection**; configuration instructions follow. Existing billing/accounting retention is unchanged. Consent withdrawal stops collection and clears visitor identity; account data deletion should additionally delete the corresponding growth account/events/payment reporting rows according to the existing accounting policy.

### Conversion and pricing presentation

**Hypothesis:** making occasional-use pricing visible beside Pro helps users choose and begin checkout. Evidence: the default pricing page previously hid CAD $4.99 credit packs behind a separate tab, while the owner reports only three evaluations per user and no net credit revenue. There is no historical funnel evidence proving this is the largest bottleneck.

The shared comparison now appears above pricing tabs and beside a free result's summary. It shows actual configured prices, credit quantity, Strict mode/full feedback and the Pro-only rewrite distinction. Links retain the evaluation ID and open the relevant pricing tab. Existing guest recovery and paid result upgrade paths are reused. English, Korean and Malay copy is included. Set `NEXT_PUBLIC_GROWTH_POSITIONING_ENABLED=false` and rebuild to revert the comparison. No prices, consumption rules or free limits changed.

### SEO

Two existing English pages receive focused title, description and introduction updates: `/assignment-rubric-checker` (college assignment intent) and `/essay-rubric-checker` (check-my-essay intent). Existing worked examples, FAQs and evaluation workflow links remain. Korean/Malay localized copy, canonical URLs and hreflang mappings remain in the existing localization system. The sitemap updates dates only for materially revised paths, and the free structured-data offer now uses CAD consistently with product pricing.

The prior Search Console export covers **June 13–September 12, 2026**, not October: 690 clicks / 5,553 impressions. Assignment page: 12 clicks / 933 impressions (1.29% CTR). Query `check my essay against rubric`: 0 / 200, mean position 30.18. The query's low ranking means title copy alone may not be sufficient. These are historical prioritization clues, not results of this change. [Existing search evidence](evidence/search-baseline.json) and [original audit](../seo/2026-09-14-seo-audit.md).

## C Funnel and acquisition analysis

Historical user-level funnel conversion rates are **unavailable**. Start the baseline on the approved deployment date, designated **D0**. Each step selects unique people entering that step during the report period, then looks forward seven days. Entrants without seven complete days are pending and excluded from the rate. Count the first evaluation attempt for the start-to-result step; match its result by attempt ID. A missing result or payment is **no observed conversion**, not proof of voluntary abandonment.

The six comparisons are visitor → evaluation start; start → viewed result; guest preview → signup proxy; signup proxy → first signed-in evaluation; free evaluation → checkout; and checkout → first successful purchase. Segments are the entry event's guest/new-account/returning-account journey, first observed source and country. The new-account journey lasts seven days from first observation. Known previous payers and unknown prior-payment history are excluded from first-purchase denominators. Mature denominators, converted counts and pending counts are shown alongside rates; reports above 50,000 rows withhold rates and require a narrower period.

Malaysia contributed **204 clicks / 479 impressions** (42.59% CTR), versus US 241 / 2,477, Australia 71 / 835 and Canada 32 / 191 in the old export. This establishes search traffic, **not Malaysian paying customers**. The admin panel can compare MY with other reliably observed country groups going forward. Unknown location remains unknown, including local/non-Vercel traffic. The historic 16-customer base cannot be assigned to Google, Malaysia or another source from these totals.

The source table ranks first paying customers and shows gross collected amount, refunds, renewal collections and Lifetime separately by original currency. Those amounts are not MRR, exclude unobserved historic transactions and may include tax. Do not use old GA4 totals as the denominator for the consented first-party cohort.

## D Revenue opportunities and pricing analysis

| Product | Repository price CAD | Included use / economic interpretation |
|---|---:|---|
| 10 credits | 4.99 one time | 10 evaluations; CAD 0.499 per included evaluation before fees and cost |
| 25 credits | 9.99 one time | 25 evaluations; CAD 0.3996 per evaluation |
| 60 credits | 19.99 one time | 60 evaluations; CAD 0.3332 per evaluation, rounded |
| Pro monthly | 7.99 / month | Unlimited evaluations, Strict, full feedback and rewrite suggestions |
| Pro annual | 59.99 / year | Same Pro features; CAD 4.9992 normalized monthly before discounts |
| Pro Lifetime | 99.99 one time | Ongoing Pro access; MRR = 0; long-term usage liability remains |

Guest: one summary preview. Free account: three free evaluations; diagnostic feedback and one leading improvement. Credits unlock detailed evaluation feedback/Strict, not rewrites. Free reservations are used before credit reservations under the existing policy; failed reserved evaluation credits are released. The legacy `plus`/`semester` plan names remain in code; no active checkout product for them was verified. Live discounts and historical prices require Stripe; display prices above are configuration, not proof every subscriber pays that amount.

Profitability cannot be estimated reliably from the incomplete $0.77 cost total. For a credit pack, full-redemption contribution = price net of tax − actual payment/Billing/FX fees − evaluations × measured variable evaluation cost. For monthly Pro, use actual monthly fees, evaluation/rewrite/OCR consumption and associated costs; for annual Pro reconcile upfront cash separately from normalized recurring contribution. For Lifetime, use cumulative realized contribution and a defined usage horizon, never recurring MRR. Measure mean, p90/p95 and maximum Pro usage before discussing price changes. Lower compute cost alone does not establish Lifetime profitability.

| Rank | Next action | Expected revenue effect | Confidence | Effort |
|---|---|---|---|---|
| 1 | Approve rollout, reconcile live Stripe, then evaluate the new result/pricing comparison | More qualified checkouts and first payers; magnitude unknown | Medium in clearer choice; low in lift until measured | Small rollout plus 14–30 days observation |
| 2 | Improve existing search pages and measure Google / MY / US cohorts; preserve Malay experience | More high-intent first payers from current traffic | Medium in traffic relevance; low in purchase attribution | Low–medium |
| 3 | Interview 3–5 recent first-time Pro purchasers and the refunded-credit purchaser before a pricing experiment | Clarify occasional use, recurring value and refund friction | Low until responses and costs are available | Low |

Channel order: existing high-intent organic search first; Malaysia organic/localized student pathways second; a small permission-based tutor/university referral pilot third. Do not start paid ads until first-purchase conversion and contribution per payer can be measured. Search themes `AI assignment feedback`, `rubric checker for college assignments` and `essay rubric feedback` are intent hypotheses, not validated current search volumes.

Interview draft, not sent: (1) “Where did you first find RubriCheck?” (2) “What made you pay, and what almost stopped you?” (3) “How many assignments/revisions do you expect to check, and would you prefer one-time credits or Pro?” Obtain permission before outreach; do not infer interview answers from billing records.

Pricing experiment proposal: first test the implemented presentation at unchanged prices. Primary outcome: mature first-purchase rate per eligible free-result viewer, with product mix and net collected CAD per eligible viewer. Guardrails: failed checkouts, refunds, canceled renewals and p95 variable cost. At this scale use sequential baseline/comparison periods matched by weekday, source and market, and report exact counts/confidence intervals. Avoid declaring a winner from one or two purchases. Only propose a live price or pack-size test after actual fee/cost/usage reconciliation, with explicit approval and existing subscriptions grandfathered. No price uplift or realized revenue lift is claimed here.

## E Measurement plan

| Review | Action |
|---|---|
| D0 + 7 days | Confirm event delivery, consent coverage, no sensitive payloads, payment reconciliation, duplicates, errors and retention job. Only the earliest entrants begin to mature; do not judge conversion lift. |
| D0 + 14 days | Compare complete seven-day entry cohorts; inspect guest/signup and free-result/checkout steps. Segment MY, US and unknown; report numerator/denominator and source coverage. Review support/refund problems. |
| D0 + 30 days | Review first payers, net collections, subscription starts/ended subscriptions, Stripe-normalized MRR/ARR and real variable contribution. Compare SEO 28-day windows and country/device/query mix. Decide whether to retain/revert positioning or gather more observations. |

Use `/admin` → **Revenue and conversion measurement** → **Review growth** (7/14/30/60/89 days). The 7-day view is a delivery/pending-cohort check; 14+ days is needed for usable mature cohorts. Refresh current GA4/GSC exports with dates and annotate the consent/GA4 configuration change. No existing reporting schedule was found and no email or recurring report was created; the owner can review at these intervals. Dates must be relative to actual deployment, not this code-review date.

## F Deployment requirements and access

1. Review and explicitly approve production changes. Apply `supabase/migrations/20261022180308_growth_analytics.sql` after `credits_mvp.sql`. No existing table/entitlement rule is replaced. The new four tables use RLS with no public policies, explicit grants only to `service_role`, and invoker functions with revoked public execution.
2. Schedule `select public.rubricheck_growth_prune();` daily using the existing approved scheduler. For an approved Supabase pg_cron installation: `select cron.schedule('rubricheck-growth-retention', '15 10 * * *', 'select public.rubricheck_growth_prune();');`. Verify execution before collection. The scheduler is a production DB change requiring the same approval; it was not installed here.
3. Configure server-only `GROWTH_HASH_SECRET` to a new stable random secret and `GROWTH_ANALYTICS_ENABLED=true`. Existing Supabase service-role and Redis settings are reused. Do not put the hash secret in `NEXT_PUBLIC_*`; rotation starts a new identity boundary and must be annotated. Set `NEXT_PUBLIC_GROWTH_POSITIONING_ENABLED=false` to hide the experiment, otherwise it is shown.
4. Enable `invoice.payment_succeeded`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.deleted`, existing subscription update/create events and `charge.refunded` for the existing Stripe webhook. Retain signature verification. Subscription starts mean paid initial invoices; cancellation reporting means ended subscriptions. Required dashboard configuration changes need approval. Replay/backfill via a reviewed, separate read-only export/import plan; no historical payment data was fabricated here.
5. GA4 remains the existing property. Before setting **`NEXT_PUBLIC_GA4_MANUAL_PAGEVIEWS=true`**, disable Enhanced Measurement history-based page views, form, site-search and outbound/download tracking in GA4, then validate the sanitized manual page-view payload. Otherwise GA4 loading remains off. Google confirms that [history-based Enhanced Measurement can still send page views when `send_page_view` is false](https://developers.google.com/analytics/devguides/collection/ga4/views). The consent change creates a new traffic measurement boundary. Vercel's existing analytics are opt-in with URL redaction and private-route suppression.
6. Deploy the reviewed feature branch only after approval, smoke-test with Stripe test data on a separate staging configuration, then verify production counts read-only. Disable `GROWTH_ANALYTICS_ENABLED` to stop first-party collection without changing billing or grading. Existing accounting data remains authoritative.

Missing access: live Stripe read-only credentials/connection; current GA4 and Google Search Console exports or authorized read access; OpenAI organization/project usage and cost export; Google Vision billing/usage export; relevant variable infrastructure invoices. A Stripe connection was offered but was not confirmed during this work. No new paid service is required. The existing Search Console ZIPs provided independent SEO work despite the missing live analytics access.

## G Implementation and verification

Core changes: `src/lib/growth*.ts`, `app/api/analytics`, `app/api/admin/growth`, existing grading/login/logout/checkout/webhook routes, `GrowthAnalytics`, `GrowthPanel`, `PlanFitNote`, localization and privacy/retention copy, the two SEO page definitions, sitemap and structured-data currency. The Supabase REST helper accepts an optional timeout for analytics calls only. New local SQL and browser checks exercise the measurement flow; existing billing, guest recovery and entitlement tests remain in place.

Branch: `growth/revenue-measurement-2026-10-22`, based on `b5975da`. This branch is for draft PR review; no merge or production rollout is authorized by this handoff.

| Check | Result and scope |
|---|---|
| `npm run test:all` | **199 passed, 0 failed.** Includes existing credit reservation/settlement, entitlement, webhook idempotency, guest recovery and new attribution/privacy/cohort/payment tests. |
| `npm run build` | Passed optimized Next.js production build. |
| `npx tsc --noEmit` and focused ESLint | Passed type checking and lint for new analytics code/components/routes. Repository-wide lint was not represented as passing. |
| `npm run test:seo` | Passed 39 public localized pages, canonical/hreflang, internal links, sitemap/robots, structured data, redirects, noindex and Open Graph checks. |
| Existing browser regressions | Passed guest preview/signup recovery, evaluation recovery, Pro/Lifetime checkout, i18n, responsive UI/keyboard, assignment workspace, rubric library and actual-results flows. These use local servers and API fixtures, not real charges or model calls. |
| Local PostgreSQL 18 | Applied existing credit schema plus the additive migration to a disposable local database; passed SQL tests for RLS/grants, service-role RPCs, duplicate events/payments, guest linkage/shared browsers, result validation, ordering, opt-out and retention. No production DDL. |
| `npm run test:growth:browser` | Passed real browser ? Next API ? local SQL RPC persistence and aggregate reads, consent/GPC, sanitized attribution, forged-purchase rejection, admin authorization, mobile pricing tabs and withdrawal. The test uses a small local HTTP adapter for PostgREST/Redis; hosted Supabase gateway behavior and Vercel country headers still need staging verification. |

The final verification manifest lists every changed file and test boundary: [verification record](evidence/2026-10-22-verification.json). Pricing screenshots: [mobile](evidence/2026-10-22-pricing-mobile.png), [desktop](evidence/2026-10-22-pricing-desktop.png).

Failures found and resolved: a rewritten internal request URL initially rejected same-origin browser analytics (fixed to validate the browser-facing Host); an opt-out test inspected cookies before navigation finished (now waits for reload); the sandbox initially blocked Google Fonts during build (local build rerun with network access); the initially located Playwright package expected an absent Chromium revision (used the already installed matching package/browser). A PowerShell default-decoding error in the external Playwright path was resolved by explicit UTF-8. PostgreSQL's PASS notice appears as `NativeCommandError` in PowerShell's stderr wrapper, but the SQL process exits 0 and rolls back the test transaction.

Remaining limitations: live Stripe reconciliation, current GA4/GSC and provider cost exports; production migration, daily retention scheduling, Stripe webhook configuration and rollout approval; sanitized GA4 property verification; staging real-service smoke testing. Payment test fixtures exercise live-mode handling locally; no real payment was submitted. First-party tracking is disabled until configured, so no measured conversion/revenue/SEO lift is claimed. Existing debug logs and unrelated regenerated screenshots are excluded from the change.
