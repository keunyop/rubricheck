<p align="center">
  <img src="./public/rubricheck-logo.svg" alt="RubriCheck logo" width="220" />
</p>

<h1 align="center">RubriCheck</h1>

<p align="center">
  AI rubric grading assistant for students, tutors, and educators.
</p>

<p align="center">
  Turn a rubric and an assignment draft into structured scoring criteria, estimated score ranges, and clear revision priorities.
</p>

<p align="center">
  <a href="https://rubricheck.com"><strong>Visit rubricheck.com</strong></a>
</p>

<p align="center">
  <img src="./public/screenshot/Hero.png" alt="RubriCheck product screenshot" width="1200" />
</p>

## Overview

RubriCheck is a web product that helps users review assignment drafts before final submission.

Instead of manually comparing a paper against a long rubric, users can upload or paste both the rubric and the assignment. RubriCheck then structures the rubric, evaluates the draft criterion by criterion, estimates a score range, and highlights the most important next revisions.

This project was also built as a portfolio piece: not just a UI demo, but an end-to-end AI product with real input handling, rate limits, monetization flows, and production-oriented guardrails.

## Why It Matters

- Rubrics are often long, inconsistent, and difficult to use for self-review.
- Students want fast, actionable feedback before submission.
- Educators and tutors need a lightweight way to preview rubric alignment without manually scoring every draft.

RubriCheck focuses on practical feedback:

- structured rubric criteria
- criterion-level score estimates
- concise feedback per criterion
- top improvement priorities
- optional Pro flows for deeper usage

## Core Experience

### 1. Submit rubric and assignment

Users can:

- upload `PDF`, `DOCX`, `TXT`, `PNG`, `JPG`, or `JPEG`
- paste rubric text directly
- paste assignment text directly

### 2. Convert rubric into structured criteria

The app turns messy rubric text into a machine-readable grading structure so later evaluation can be consistent and predictable.

### 3. Evaluate the draft against the rubric

RubriCheck returns:

- overall estimated score range
- criterion-by-criterion feedback
- evidence-aware reasoning
- top 3 revision priorities

### 4. Share and iterate

Users can review the result, export a shareable summary image, and revise before submitting their real assignment.

## Product Highlights

- AI-assisted rubric structuring and draft evaluation
- Standard mode and Strict mode for different grading expectations
- File parsing pipeline for `PDF`, `DOCX`, `TXT`, and image OCR (`PNG`, `JPG`, `JPEG`)
- Usage limiting with Upstash Redis
- Pro / paid feature surface for rewrite and expanded access
- Stripe checkout and entitlement recovery flow
- Shareable results image generation

## Tech Stack

RubriCheck was designed as a practical SaaS-style AI product rather than a prototype.

- Frontend: `Next.js App Router`, `React 19`, `TypeScript`, `Tailwind CSS 4`
- Backend: `Next.js Route Handlers`
- AI integration: `OpenAI API`
- Validation: `Zod`
- File parsing: `pdf-parse`, `mammoth`, `Google Cloud Vision OCR` (image inputs)
- Billing: `Stripe`
- Rate limiting and lightweight session data: `Upstash Redis`
- Data / billing ledger: `Supabase Postgres`
- Deployment and monitoring: `Vercel Analytics`, `Vercel Speed Insights`

## Environment

- `GOOGLE_CLOUD_VISION_API_KEY`: API key for Google Vision OCR
- `GOOGLE_VISION_LANGUAGE_HINTS` (optional): comma-separated OCR language hints (default: `en,ko`)

## What This Project Demonstrates

As a portfolio project, RubriCheck shows experience across both product thinking and implementation:

- turning an education workflow into a focused SaaS product
- designing AI output around structured, usable results instead of raw generation
- handling real-world edge cases like file validation, usage limits, and entitlement restoration
- connecting product UX with billing, access control, and deployment concerns
- building a clean end-to-end flow from landing page to evaluation result

## System Flow

1. User submits a rubric and assignment draft.
2. The server validates files and input size.
3. The rubric is converted into structured grading criteria.
4. The draft is evaluated against each criterion.
5. The response is normalized into score ranges, feedback, and improvement priorities.
6. The UI renders a result that is easy to review and share.



## Live Product

- Website: https://rubricheck.com

## Free evaluation usage

Before deploying the reservation-based evaluation flow, apply `supabase/free_evaluate_reservations.sql` after the existing billing schema. See [deployment, behavior and verification](doc/free-evaluation-reservations.md).


## Assignment sidebar and projects

The home sidebar lists account-specific projects and recent evaluations. Search (Ctrl/Cmd+K)
finds assignments by title or project name. Projects group successive evaluated drafts; results
can be moved between projects, and deleting a project keeps its assignments in Recents.

History uses the existing Upstash Redis configuration (no SQL migration). Account namespaces
are derived from verified session emails. Results and project metadata have no automatic expiry;
raw rubric/assignment inputs retain the existing 24-hour recovery TTL (extended for checkout).
Only server-generated feedback is archived, with the original feedback access tier enforced.
The metadata hash is separate from result snapshots so listing history does not load full feedback.

New evaluations are archived automatically. A previously saved browser result is imported only
while its account-owned server recovery record is still available. Already expired evaluations
cannot be reconstructed. A history storage failure leaves the successful grading result usable
and displays a notice. Account data deletion must remove the account workspace hash and its
associated result keys in addition to other account data.

Validation: `npm run test:all` and `node scripts/check_assignment_workspace.mjs`.
The browser check uses mocked API responses; set `TEST_BASE_URL` for a local Next server and
`PLAYWRIGHT_MODULE` if Playwright is installed outside this repository.

## Product feedback

The home and pricing Feedback buttons open an in-app form for guests and signed-in users.
Messages are stored in the existing Upstash Redis instance (no migration or new environment variables).
The admin dashboard has a Feedback inbox with newest-first pages of 25, refresh, and retry.
Only existing admin sessions or the configured admin secret can read `/api/admin/feedback`.
Submission accepts up to 5,000 characters and an optional reply email; verified account identity
comes from the server session. Limits allow five messages per hour per account, or IP for guests.
The inbox key is `rubricheck:{feedback}:inbox`; messages have no automatic expiry. Account data
deletion must also remove matching feedback records. Query strings and raw IPs are not stored.
`NEXT_PUBLIC_FEEDBACK_URL` is no longer used.

Validation: `npm run test:all` and `node scripts/check_feedback_navigation.mjs` against a local
Next server (supports `TEST_BASE_URL` and `PLAYWRIGHT_MODULE`). Browser checks mock API responses.

## Guest samples and assignment previews

The home page offers a prepared sample (no AI request or quota use) and one guest
assignment preview. Guests can upload the existing supported file formats or paste
text, with a 20,000-character limit for each parsed input and Standard mode only.
The response includes only the Evaluation Summary; criterion feedback stays on the server.

Guest access requires the existing Upstash Redis configuration. No migration or new
environment variable is needed. Atomic reservations prevent concurrent checks,
release on failures, and fail closed when storage is unavailable. A random HttpOnly
cookie enforces one successful preview per browser for up to one year; a hashed IP
marker also limits the same network to one preview per 24 hours. Deploy behind a
trusted proxy that sets the client IP headers, as with the existing usage limits.
Shared-network visitors who reach this limit can sign up for their account checks.

Inputs and results expire after 24 hours. After email verification, the same browser
can claim the saved evaluation and view the existing Free-tier criterion feedback
without another model call or consuming account checks. The original Free/Top-up/Pro
detail restrictions still apply. Claiming is bound to one verified account and
supports retries. Account free usage, paid credits, and project evaluations keep
their existing billing paths.

Validation: `npm run test:all`, `npm run test:trial:browser`, and the existing
workspace, recovery, and feedback browser scripts. Browser tests use mocked API
responses; set `TEST_BASE_URL` for a local Next server and `PLAYWRIGHT_MODULE`
if Playwright is installed outside this repository.
