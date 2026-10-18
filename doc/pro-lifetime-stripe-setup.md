# Pro Lifetime — Stripe setup

Pro Lifetime is CAD $99.99 paid once, with the existing Pro features and no recurring billing. Korean label: **Pro 평생 이용권**. There is no introductory price or customer-count limit.

The pricing option and checkout API are enabled in source. `src/config/proCheckout.ts` binds lifetime checkout to the user-supplied Price ID **`price_1URj6hBUXk6e3lrdOBfYg02a`**. The user confirmed this is a **Live-mode CAD $99.99** price. The server retrieves it directly, so a lookup key is not required. Before opening checkout it checks that the price and product are active and the price is a CAD $99.99 one-time payment. `PRO_LIFETIME_CURRENCY` is shared by price, checkout-session, and PaymentIntent validation; the pricing page explicitly displays **CAD $99.99**.

## Stripe 대시보드 설정

1. Stripe 대시보드에서 먼저 **테스트 모드 또는 Sandbox**를 선택합니다.
2. **Product catalog(상품 카탈로그) → + Add product(상품 추가)**를 엽니다. 메뉴가 접혀 있으면 **More**에서 찾습니다.
3. 상품 이름은 **RubriCheck Pro Lifetime**으로 입력합니다.
4. 설명은 **One-time purchase for ongoing access to RubriCheck Pro. No recurring charges.**로 입력합니다.
5. 가격 유형은 **Flat rate → One time(일회성)**을 선택합니다. **Recurring(정기 결제)**은 선택하지 않습니다.
6. 통화 **CAD**, 금액 **99.99**를 입력하고 저장합니다. 기존 월간·연간 가격은 수정하지 않습니다.
7. 생성한 **`price_...` ID**를 보관합니다. 현재 코드는 제공받은 Price ID를 직접 사용하므로 **Lookup key는 필수가 아닙니다**. 기존 `pro_lifetime` lookup key도 과거 결제의 권한 확인에는 계속 지원합니다.
8. 기존 웹훅 목적지 **`https://rubricheck.com/api/stripe/webhook`**를 엽니다. 테스트 모드에는 테스트 환경의 웹훅 주소를 사용합니다. 기존 이벤트를 유지하면서 **`checkout.session.completed`**, **`checkout.session.async_payment_succeeded`**, **`charge.refunded`**가 포함되는지 확인합니다.
9. 테스트 환경에서 구매·복원·환불을 확인한 후, **Live mode**에 같은 상품과 가격을 만듭니다. Dashboard에 **Copy to live mode**가 있으면 사용할 수 있습니다. Live 가격도 **CAD 99.99 / One time / Active**인지 확인합니다. 테스트와 Live의 `price_...` ID는 서로 다릅니다.
10. 다른 가격으로 변경할 때는 `PRO_LIFETIME_STRIPE_PRICE_ID`를 업데이트하고 테스트 후 배포합니다. 테스트 키에서는 Live 가격을 조회할 수 없으므로 운영 배포의 Stripe 키와 가격 모드를 일치시켜야 합니다.

Stripe references: [Products and prices](https://docs.stripe.com/products-prices/manage-prices), [Checkout Session modes](https://docs.stripe.com/api/checkout/sessions/create), [Event types](https://docs.stripe.com/api/events/types).

## Maintainer activation

The sales switch is `true` following the user's Price ID handoff. Deployment readiness still requires:

- Stripe can retrieve `price_1URj6hBUXk6e3lrdOBfYg02a` using the deployment's key, with `active=true`, `type=one_time`, `currency=cad`, `unit_amount=9999`, and an active product. The API rejects an invalid price before creating a checkout session.
- The existing Supabase `account_entitlements` table and its get/upsert RPCs are installed, and Redis is configured. No new SQL migration or secret is needed.
- The configured Stripe account/mode and the webhook endpoint match the application environment.
- In an isolated test deployment, use the matching test-mode Price ID and verify payment, return-to-result recovery, sign-out/sign-in, billing status, and full refund. Use Stripe test cards only in test mode; retain the supplied production Price ID in the production source.
- Deploy the source change to apply activation to the hosted site. The shared `PRO_LIFETIME_CHECKOUT_ENABLED` switch can be set back to `false` to stop new sales without revoking existing access.

The current local `.env.local` contains a **test-mode Stripe key**. A read-only request for the supplied Price ID returned `404 resource_missing` in that environment; the user subsequently confirmed the price is **Live-mode CAD $99.99**. No real purchase, refund, or Live webhook change was made. Confirm Live settings in the deployment's account before treating payment verification as complete.

## Entitlement behavior

- A lifetime checkout uses `mode=payment`, quantity one, and creates its own Stripe customer. It cannot create a recurring subscription. Existing active Pro accounts are directed to their current access rather than charged again; upgrades from an active subscription need a separate future migration policy.
- Lifetime fulfillment validates the actual Stripe line item against the configured Price ID or legacy lookup key, fixed CAD amount, complete/paid session, subtotal, and settled PaymentIntent. Metadata alone cannot grant access.
- Both the return confirmation route and Stripe webhooks persist access. Retried payment events can retry persistence; access upserts and credit purchase IDs keep fulfillment idempotent.
- The existing finite-epoch entitlement schema uses the reserved `253402300799` epoch (year 9999) as a compatibility marker for non-expiring access. It is never shown as a renewal/expiry date; billing shows **Pro Lifetime** and no recurring charge.
- Each lifetime checkout gets a new Stripe customer, isolating its durable entitlement row from older subscription cancellation events. The existing email lookup selects active access with the latest period end, so lifetime access takes precedence. Login can reconstruct access from Stripe checkout sessions when cached hints are missing.
- A full Stripe refund revokes the lifetime entitlement. Partial refunds retain access. Replayed checkout confirmations read the current charge before persisting, so a refunded purchase remains canceled. Other active subscriptions under the same email remain independent.
- Payment success and refunds still process if the sales switch is subsequently disabled. The switch controls new purchases, not existing owners' access.
- All entitlement RPCs continue to run only on the server with the existing service role. No public database grants or client secrets are added.

## Verification

Run `npm run test:all`, `npm run lint`, and `npm run build`.

With a local server on port 3100, run `node scripts/check_pro_lifetime.mjs`. It checks the enabled option and explicit CAD $99.99 price on desktop/mobile in English, Korean, and Malay; checks monthly/annual selection; walks a signed-in fixture checkout redirect; and checks the lifetime billing state. API tests independently cover authentication, the exact supplied price without a lookup key, invalid/archived prices and products, and duplicate-purchase prevention. These checks do not make real Stripe purchases.

Local verification on 2026-10-17:

- The CAD correction passed all 22 focused billing tests, including the configured CAD Price ID without a lookup key, rejection of USD prices/sessions/PaymentIntents, authentication, invalid prices/products, duplicate Pro purchase prevention, replayed refunds, and durable-write retries.
- The production build and TypeScript checks passed. Google Fonts required network access during the build.
- ESLint passed for every changed TypeScript/TSX/JavaScript file. Repository-wide lint still reports six pre-existing `no-require-imports` errors in `doc/growth/browser-audit.cjs` and `doc/growth/public-flow-audit.cjs`.
- The production-server browser check passed in all three languages at widths 390 and 1440, with no page errors or horizontal overflow. The enabled lifetime option explicitly displayed **CAD $99.99**, the signed-in fixture checkout submitted `plan: "lifetime"` and followed its checkout redirect, and lifetime billing displayed no recurring cancellation control. [Mobile screenshot](verification/lifetime/pricing-390.png), [desktop screenshot](verification/lifetime/pricing-1440.png).
