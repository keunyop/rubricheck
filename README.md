# RubriCheck

RubriCheck is an AI-assisted grading workflow that helps students and educators evaluate assignment drafts against a rubric before final submission.

It accepts rubric + assignment input (file upload or pasted text), structures the rubric, estimates criterion-level score ranges, and returns actionable feedback.

## Product Summary

- Problem: Rubric-based grading is time-consuming and inconsistent when students self-review.
- Solution: A guided AI flow that converts raw rubric text into structured criteria and evaluates work against it.
- Target users: Students preparing submissions, tutors, and instructors who want fast draft feedback.

## Core Features

- Multi-input support
  - Upload `PDF`, `DOCX`, `TXT` (up to 5MB) or paste text directly.
- Rubric structuring
  - Converts unstructured rubric text into machine-readable grading criteria.
- Assignment evaluation
  - Returns criterion-level estimated ranges and feedback.
  - Produces overall estimated score range (scaled to 100).
  - Highlights top three improvement priorities.
- Share-ready output
  - Generates a shareable summary image from results.
- Usage control
  - Rate-limited daily usage using Upstash Redis.
- Pro gating
  - Rewrite mode is exposed as a Pro feature entry point.

## Grading Modes
### Standard
Balanced score estimate.

### 🔥 Strict Mode
Simulates a tough academic marker. Expect lower but more defensible scores.
Evidence-based and conservative scoring; requires quotes per criterion.

## Branch Status

- `main`
  - Stable core grading flow.
- `feature/stripe-pro-checkout`
  - Adds Stripe Checkout entry for upgrading to Pro.
  - Uses checkout session redirect flow and billing success/cancel pages.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Backend: Next.js Route Handlers
- AI: OpenAI API (rubric structuring + evaluation prompts)
- Storage/limits: Upstash Redis
- Billing (feature branch): Stripe Checkout

## System Flow

1. User submits rubric and assignment (file or text).
2. Server parses input and validates file/size/type.
3. Rubric is structured into criteria.
4. Assignment is evaluated against criteria.
5. API returns summary, per-criterion ranges, and top improvements.
6. UI renders report and optional Pro upgrade entry.

## API Endpoints

- `POST /api/grade`
  - Main grading pipeline (parse -> structure -> evaluate -> normalize output).
- `POST /api/rewrite`
  - Rewrite-related endpoint (Pro surface area).
- `POST /api/evaluate`
  - Evaluation-focused endpoint.
- `POST /api/simulate`
  - Simulation/testing endpoint.
- `POST /api/checkout` (feature branch)
  - Creates Stripe Checkout Session and returns redirect URL.
- `GET /api/entitlement`
  - Returns entitlement session status (`active` or `needs_restore`).
- `POST /api/entitlement/restore/start`
  - Starts email OTP verification for Pro restore.
- `POST /api/entitlement/restore/verify`
  - Verifies OTP, re-checks Stripe subscription, and re-issues Pro session cookie.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create `.env.local`:

```bash
OPENAI_API_KEY=...
STRUCTURE_MODEL=...
EVALUATION_MODEL=...
OPENAI_TIMEOUT_MS=180000 # optional (default: 180000, max: 600000)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_FEEDBACK_URL=...
NEXT_PUBLIC_COPY_VARIANT=... # optional (e.g. default, student)
NEXT_PUBLIC_APP_ENV=development # set to production on Vercel
```

Deployment note:
- `NEXT_PUBLIC_*` variables are baked into the client bundle at build time. If you change `NEXT_PUBLIC_APP_ENV` (or any `NEXT_PUBLIC_*` value), trigger a new build/redeploy so client-side gating/UI reflects the new value.

Stripe-related variables (needed for checkout integration on `feature/stripe-pro-checkout`):

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENTITLEMENT_SESSION_SECRET=... # recommended (fallbacks to STRIPE_WEBHOOK_SECRET if missing)
ENTITLEMENT_OTP_SECRET=... # recommended for OTP hashing (fallbacks to session secret)
RESEND_API_KEY=... # optional in dev, required in prod for OTP email send
OTP_FROM_EMAIL=... # e.g. no-reply@yourdomain.com
```

Stripe setup note:
- Configure Pro monthly Price with `lookup_key=pro_monthly`.
- Configure Pro annual Price with `lookup_key=pro_annual`.
- Configure one-time Credit Pack Prices with:
  - `lookup_key=credits_10_v1`
  - `lookup_key=credits_25_v1`
  - `lookup_key=credits_60_v1`

## Redis Keys

- Usage limits
  - `rubricheck:usage:{ip}:{yyyy-mm-dd}:{feature}`
- Entitlement storage
  - `rubricheck:customerByEmail:{email}` -> Stripe customer ID
  - `rubricheck:entitlement:{stripeCustomerId}` -> `{ plan, status, currentPeriodEnd, updatedAt }`
- Stripe lookup cache (restore)
  - `rubricheck:stripeLookupByEmail:{email}` -> `{ customerId, entitlement, checkedAt }` (short TTL)
- Restore OTP / anti-abuse
  - `rubricheck:restore:otp:code:{email}` -> hashed code record (10m TTL)
  - `rubricheck:restore:otp:send:email:{email}` -> send rate limit counter (10m window)
  - `rubricheck:restore:otp:send:ip:{ip}` -> send rate limit counter (10m window)
  - `rubricheck:restore:otp:verify:{email}:{ip}` -> verify rate limit counter (10m window)

## Restoring Pro After Session Expiry

- Pro purchase and Pro restore are separate flows:
  - Purchase: `POST /api/checkout` (Stripe Checkout).
  - Restore: email OTP verification + Stripe entitlement re-check.
- If `rubricheck_entitlement` cookie is missing/expired:
  - UI shows both `Restore Pro` and `Upgrade to Pro`.
  - `GET /api/entitlement` returns `needs_restore` instead of forcing checkout.
- Restore flow:
  1. User enters email (`/api/entitlement/restore/start`).
  2. Server sends 6-digit OTP (dev mode logs code to server if email provider not configured).
  3. User submits OTP (`/api/entitlement/restore/verify`).
  4. Server verifies OTP, checks active/trialing `pro_monthly` subscription via Redis/Stripe, then re-issues `rubricheck_entitlement` cookie (12h).

## E2E Restore Checklist

1. Buy Pro and verify Pro features are available.
2. Clear cookies (or wait 12h cookie TTL).
3. Trigger a Pro gate and confirm both `Restore Pro` and `Upgrade to Pro` are shown.
4. Restore with the same email and OTP; verify Pro access returns without payment.
5. Verify a non-subscriber email cannot restore and is shown upgrade CTA.
6. Verify OTP send/verify rate limits (5 attempts per 10 minutes) are enforced.

## Portfolio Value

This project is designed to demonstrate:

- End-to-end product thinking (problem framing -> UX -> API -> monetization path)
- Practical AI integration with guardrails and output normalization
- Real-world engineering concerns (validation, rate limiting, failure handling)
- SaaS-ready architecture patterns for future account/billing expansion

## Roadmap

- User accounts and subscription state sync
- Webhook-based billing lifecycle handling
- Saved report history and analytics
- Improved rubric templates and domain-specific tuning
