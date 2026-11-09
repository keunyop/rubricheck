# 접근 지도와 지표 기준

## 현재 구조를 찾는 위치

- 제품/요금: `README.md`, `src/config/proCheckout.ts`, `src/config/creditPacks.ts`; live Stripe Price와 checkout 검증 코드를 대조한다. 문서 가격을 현재 결제 사실로 단정하지 않는다.
- 평가: `app/api/evaluate`, `app/api/grade`, `lib/gradeFinalization.ts`; 진단과 피드백은 관리자 API 및 `src/lib` 관련 store에서 찾는다. 실패 아카이브는 7일 TTL, 보존 제한이 있어 전체 실패율 분모가 아니다.
- 결제/사용자: `supabase/admin_dashboard.sql`, credit/billing SQL, Stripe live 계정. 관리자 knownUsers는 billing/free ledger에 등장한 계정의 합집합이며 MAU나 전체 가입자 수가 아니다. Pro entitlement는 recurring active 구독과 같지 않다.
- 퍼널: `src/lib/growth.ts`, GA4/analytics 컴포넌트, `supabase/growth*`. 실제 테이블·환경 플래그·최근 이벤트를 확인한다. 기존 allowlist, consent, dedupe를 보존한다.
- 과거 근거: `doc/growth`, `doc/seo`, `doc/verification`; 각 기록의 기간과 배포 여부를 확인한다. `.growth-local`의 기존 CSV는 과거 자료다.

## 정의

모든 관측은 metric, value 또는 missing_reason, source, period_start/end(끝 제외), source_timezone, fetched_at, latest_event_at, numerator/denominator, sample_size, currency, completeness, caveats를 함께 저장한다. 서로 다른 통화를 환율 근거 없이 합산하지 않는다.

| 영역 | 정의와 주의 |
| --- | --- |
| 유료 구독 | Stripe live recurring active를 기준으로 trial·연체·취소 예약·실제 종료·lifetime을 따로 집계. 사용자 단위와 subscription 단위를 구분 |
| MRR | 현재 recurring 금액 × 수량을 월 환산(연간 ÷12). 할인·세금 처리 기준 명시. lifetime/credits 제외. 환율 미확인 시 통화별 표시 |
| 순증 | 같은 정의의 신규 + 재활성 - 실제 종료. created 수만으로 신규 유료 활성이라 하지 않음. cancel_at_period_end는 종료가 아님 |
| 현금 수입 | 성공 결제 금액과 환불 발생액을 별도 표시. payment/charge/invoice 중복 제거. gross-refunds는 수수료·비용 차감 순이익이 아님 |
| 퍼널 | 방문 → 확인된 가입 → 고유 첫 성공 평가 → 이후 별도 성공 평가 → checkout 시작 → 검증된 유료 결제. 단계별 대상 cohort와 분모를 명시. GA4 purchase만으로 실제 결제 확정 금지 |
| 유지 | 가입 cohort의 D7/D28 재사용은 관찰 기간이 끝난 cohort만. 갱신은 갱신 예정 유료 구독 중 실제 결제 성공. 취소 이유는 코드/설문으로 구분 |
| 품질 | request/attempt ID별 terminal outcome으로 성공/실패/미완료 구분, 중복 로그 제거. 영향 사용자 수, 재시도, 처리시간 p50/p95, 결과 불만을 분리. 로그 그룹 수를 고유 실패 건수로 쓰지 않음 |
| 검색 | GSC property/검색 유형/기간/페이지/검색어/국가/기기별 clicks, impressions, CTR=clicks/impressions, position. 익명 검색어 누락과 행 한도를 기록. 개인 결제와 직접 join 금지 |
| 비용 | AI input/cached/output tokens 및 실제 요율, OCR 페이지·요청, 인프라, Stripe 수수료, 운영 도구·에이전트 비용. 검증된 비용 합계 ÷ 성공 평가 수. 누락은 미확인, 모델 요율로 계산하면 추정 |

완결된 최근 28일과 이전 28일이 기본이다. Vancouver 자정은 DST 때문에 고정 UTC offset이 아니다. GSC 날짜, GA4 property timezone, Stripe timestamp의 기준을 별도로 기록한다. 성과를 인과 효과로 단정하지 않는다.

## 접근이 없는 경우

GSC는 해당 property Restricted, GA4는 해당 property Viewer와 수익 데이터 제한 상태부터 확인한다. 조회용 권한과 GA4–GSC 연결 생성 권한은 다르다. 커넥터가 설치됐다는 이유로 접근 가능 처리하지 않는다. 비밀번호·토큰을 채팅으로 받지 않는다.

대안 CSV: 공통으로 최신 완결 56일, source timezone·exported_at·latest_complete_date 포함. GSC는 date/query/page/country/device/clicks/impressions/CTR/position 및 필터·검색 유형, GA4는 date/landing page/source/medium/country/device/users/sessions/event name/event count/key events와 key-event 설정 및 GSC link 상태. 이메일·원문·계정 ID는 불필요하다. 다른 breakdown의 총계를 더하지 않는다.

원천 접근은 성공했어도 데이터가 없으면 `미측정`, 권한 실패면 `접근 불가`, 표본/상한으로 제한되면 `부분`으로 기록한다. cursor는 조회가 끝난 범위에만 전진시킨다.
