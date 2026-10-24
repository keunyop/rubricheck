# Node.js runtime maintenance

RubriCheck supports stable Node.js 24 releases starting at **24.22.1**.
This minimum includes the [October 21, 2026 security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases),
including the Brotli decoder memory corruption issue CVE-2026-111497.
Exposure depends on whether an application decompresses attacker-controlled Brotli
input; an affected version alone is not evidence that a server was compromised.

Use a maintained version manager or the [official Node.js installer](https://nodejs.org/en/download/archive/v24.22.1).
Verify downloaded artifacts using Node.js SHASUMS and the platform signature.
After updating, run `node --version`, `npm run check:runtime`, `npm run test:all`
and `npm run build`. Restart existing processes so they use the patched executable.
The repository's startup and build checks reject older runtimes; `instrumentation.ts`
also checks the actual Node.js runtime when each Next.js server initializes.

On Vercel, keep the project on `24.x`, rebuild from reviewed source without the
build cache, and inspect both build and runtime `NODE_RUNTIME_VERIFIED` messages.
[Vercel selects major versions and manages minor/patch releases](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
The `package.json` engine range selects the major line; the explicit checks enforce
the security minimum. Never restore an older deployment without verifying its runtime.

If credentials might have been exposed:

1. Preserve available logs and review the host for unauthorized access. Patch or
   rebuild the environment before generating replacement credentials. A fresh build
   is not a forensic attestation that every connected system is clean.
2. Inspect Stripe Workbench request logs for each affected key, including read-only
   calls and failed calls. Review security history, bank accounts, webhook endpoints,
   charges, refunds and payouts. Stripe events alone do not expose API key use or all
   Dashboard changes. Hosting log retention may be shorter than the incident window.
3. Roll potentially exposed live and sandbox keys in the correct Stripe account's
   Dashboard. Store the replacement directly in the deployment's `STRIPE_SECRET_KEY`
   secret setting, redeploy, verify authentication/payment flows, then expire the old
   key promptly. If abuse is confirmed, expire it immediately and contact Stripe.
   Never put replacement credentials in chat, source control or command arguments.
4. Rotate the separate `STRIPE_WEBHOOK_SECRET` if it could have been exposed. Coordinate
   the signing-secret overlap, deployment and webhook delivery checks. This value may
   also be a fallback for application signing secrets; inspect configured dedicated
   session/OTP/abuse secrets before changing it.
5. Keep production and sandbox credentials separate. Prefer a restricted API key after
   validating the required permissions in a sandbox. Current integration calls need
   checkout sessions (read/write), customers (read), prices (read), subscriptions
   (read), payment intents (read), charges (read), refunds (read/write), and billing
   portal sessions (write). Validate permission names against the current Dashboard;
   avoid granting payout, transfer or account administration privileges.

Stripe references: [request logs](https://docs.stripe.com/development/dashboard/request-logs),
[key rotation](https://docs.stripe.com/keys#rolling-keys),
[compromised keys](https://support.stripe.com/questions/protecting-against-compromised-api-keys),
[key storage and access controls](https://docs.stripe.com/keys-best-practices).
