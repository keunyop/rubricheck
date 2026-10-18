# Pro Lifetime — Stripe setup

Pro Lifetime is USD $99.99 paid once, with the existing Pro features and no recurring billing. Korean label: **Pro 평생 이용권**. There is no introductory price or customer-count limit.

The pricing page shows the price and a disabled **Coming soon / 준비 중** option. The shared `PRO_LIFETIME_CHECKOUT_ENABLED` switch in `src/config/proCheckout.ts` is deliberately `false`; `/api/checkout` also rejects `plan: "lifetime"` and the legacy `priceId: "pro_lifetime"` with `409 PLAN_UNAVAILABLE`. Creating a Stripe product alone does not enable sales.

## Stripe 대시보드 설정

1. Stripe 대시보드에서 먼저 **테스트 모드 또는 Sandbox**를 선택합니다.
2. **Product catalog(상품 카탈로그) → + Add product(상품 추가)**를 엽니다. 메뉴가 접혀 있으면 **More**에서 찾습니다.
3. 상품 이름은 **RubriCheck Pro Lifetime**으로 입력합니다.
4. 설명은 **One-time purchase for ongoing access to RubriCheck Pro. No recurring charges.**로 입력합니다.
5. 가격 유형은 **Flat rate → One time(일회성)**을 선택합니다. **Recurring(정기 결제)**은 선택하지 않습니다.
6. 통화 **USD**, 금액 **99.99**를 입력하고 저장합니다. 기존 월간·연간 가격은 수정하지 않습니다.
7. 생성된 가격의 상세 화면 또는 가격 편집/고급 옵션에서 **Lookup key**를 **`pro_lifetime`**으로 지정합니다. Product metadata가 아니라 **Price의 lookup key**입니다. 이 입력란이 보이지 않으면 생성한 `price_...` ID를 보관합니다. 개발자가 Stripe API/CLI로 해당 가격의 `lookup_key`를 설정할 수 있습니다.
8. 기존 웹훅 목적지 **`https://rubricheck.com/api/stripe/webhook`**를 엽니다. 테스트 모드에는 테스트 환경의 웹훅 주소를 사용합니다. 기존 이벤트를 유지하면서 **`checkout.session.completed`**, **`checkout.session.async_payment_succeeded`**, **`charge.refunded`**가 포함되는지 확인합니다.
9. 테스트 환경에서 구매·복원·환불을 확인한 후, **Live mode**에 같은 상품과 가격을 만듭니다. Dashboard에 **Copy to live mode**가 있으면 사용할 수 있습니다. Live 가격도 **USD 99.99 / One time / lookup key `pro_lifetime` / Active**인지 확인합니다. 테스트와 Live의 `price_...` ID는 서로 다릅니다.
10. Live의 **`price_...` ID**와 설정 완료 여부를 알려주면 마지막으로 활성화할 수 있습니다. ID는 비밀 키가 아닙니다. Stripe secret key나 webhook signing secret을 채팅으로 보낼 필요는 없습니다.

Stripe references: [Products and prices](https://docs.stripe.com/products-prices/manage-prices), [Checkout Session modes](https://docs.stripe.com/api/checkout/sessions/create), [Event types](https://docs.stripe.com/api/events/types).

## Maintainer activation

Keep the switch off until Stripe configuration is complete. Before activation, confirm:

- Stripe returns exactly one active `pro_lifetime` Price, `type=one_time`, `currency=usd`, `unit_amount=9999`.
- The existing Supabase `account_entitlements` table and its get/upsert RPCs are installed, and Redis is configured. No new SQL migration or secret is needed.
- The configured Stripe account/mode and the webhook endpoint match the application environment.
- In an isolated test deployment, enable the switch and verify payment, return-to-result recovery, sign-out/sign-in, billing status, and full refund. Use Stripe test cards only in test mode.
- After the user's setup-complete instruction, change `PRO_LIFETIME_CHECKOUT_ENABLED` to `true`, update the disabled-plan test expectations for the active state, and redeploy. This is a source-controlled switch shared by UI and API; there is no automatic activation when a price appears in Stripe.

## Entitlement behavior

- A lifetime checkout uses `mode=payment`, quantity one, and creates its own Stripe customer. It cannot create a recurring subscription. Existing active Pro accounts are directed to their current access rather than charged again; upgrades from an active subscription need a separate future migration policy.
- Lifetime fulfillment validates the actual Stripe line item, fixed USD price, complete/paid session, subtotal, and settled PaymentIntent. Metadata alone cannot grant access.
- Both the return confirmation route and Stripe webhooks persist access. Retried payment events can retry persistence; access upserts and credit purchase IDs keep fulfillment idempotent.
- The existing finite-epoch entitlement schema uses the reserved `253402300799` epoch (year 9999) as a compatibility marker for non-expiring access. It is never shown as a renewal/expiry date; billing shows **Pro Lifetime** and no recurring charge.
- Each lifetime checkout gets a new Stripe customer, isolating its durable entitlement row from older subscription cancellation events. The existing email lookup selects active access with the latest period end, so lifetime access takes precedence. Login can reconstruct access from Stripe checkout sessions when cached hints are missing.
- A full Stripe refund revokes the lifetime entitlement. Partial refunds retain access. Replayed checkout confirmations read the current charge before persisting, so a refunded purchase remains canceled. Other active subscriptions under the same email remain independent.
- Payment success and refunds still process if the sales switch is subsequently disabled. The switch controls new purchases, not existing owners' access.
- All entitlement RPCs continue to run only on the server with the existing service role. No public database grants or client secrets are added.

## Verification

Run `npm run test:all`, `npm run lint`, and `npm run build`.

With a local server on port 3100, run `node scripts/check_pro_lifetime.mjs`. It checks the disabled option and price on desktop/mobile in English, Korean, and Malay; checks monthly/annual selection; and checks the lifetime billing state using fixture API responses. Route tests separately verify disabled API requests without making a Stripe purchase. Real Stripe payment/refund verification is deferred until the product exists.

Local verification on 2026-10-17:

- All 175 automated tests passed, including fixed-price fulfillment, disabled API requests, replayed refunds, independent subscription access, and retry after a durable-write failure.
- The production build passed, including TypeScript checks. Google Fonts required network access; stale generated development type files were cleared after stopping the local dev server.
- ESLint passed for every changed TypeScript/TSX/JavaScript file. Repository-wide lint still reports six pre-existing `no-require-imports` errors in `doc/growth/browser-audit.cjs` and `doc/growth/public-flow-audit.cjs`.
- The browser check passed in all three languages at widths 390 and 1440, with no page errors or horizontal overflow. [Mobile screenshot](verification/lifetime/pricing-390.png), [desktop screenshot](verification/lifetime/pricing-1440.png).
