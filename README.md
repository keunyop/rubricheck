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
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_FEEDBACK_URL=...
```

Stripe-related variables (needed for checkout integration on `feature/stripe-pro-checkout`):

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Stripe setup note:
- Configure Pro monthly Price with `lookup_key=pro_monthly`.

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
