# 2026년 11월 9일 최초 운영 실행

실행 모드 weekly. 소스·기존 운영 기록·연결을 확인하고, 재사용할 운영 스킬과 검증 가능한 작은 개선 두 건을 준비했다. 사용자의 최초 위임 범위 안에서 수행했으며 production 게시와 예약 자동화는 실행하지 않았다.

## 완료한 작업

1. OPS-001: [owner skill](../../../.agents/skills/rubricheck-owner/SKILL.md), [역할 설정](../../../.codex/agents/), [운영 기준](../operating-model.md), [backlog](../backlog.md), [상태](../state.json), [성과 기록](../experiments.md)을 작성했다. 최초 저장소와 상위 디렉터리에서 AGENTS.md는 발견되지 않았다. 새 도구/프로젝트 생성 없이 기존 Git·관리자·분석 소스를 사용했다.
2. QUAL-001: [최종 점수 계산](../../../lib/gradeFinalization.ts)에서 소수 배점 반올림으로 최대 배점보다 높은 점수가 나오는 문제를 재현했다. Standard/Strict 각각 상한 1줄을 기존 범위 계산과 같은 정수 내림으로 변경하고 [두 회귀](../../../lib/gradeFinalization.test.ts)를 추가했다. 2.5점 항목에 3점을 주는 출력이 차단된다. 정수 점수 계약을 유지하므로 0.5점 항목은 여전히 0점만 가능하며 소수 점수 지원은 별도 과제다. 저장된 과거 평가나 프롬프트는 변경하지 않았다.
3. GROW-001: [공개 경로 목록](../../../src/lib/growth.ts)에 `/ai-quiz-generator`를 추가했다. 기존 pageview/attribution 수집 누락을 고치며 새 이벤트/수집 플래그를 추가하지 않았다. [회귀](../../../src/lib/growth.test.ts)는 7개 언어, 검색 유입 유지, 쿼리·해시 제거, 비공개 퀴즈 경로 차단을 확인한다.

CTO·Growth·Data 역할을 실제 하위 에이전트 `gpt-6.1-sol/high`로 분리했다. 파일 소유권을 분리하고 CTO가 Growth 변경을 독립 검토했다. PO는 점수 상한 수정과 기존 정수 계약의 일치 여부를 검토했다.

## 검증과 출시 상태

- 수정 전 신규 회귀 실패를 재현했고 수정 후 관련 테스트가 통과했다.
- `node scripts/run_all_tests.mjs`: 318 passed, 0 failed. 제품 두 수정이 포함된 실행이다.
- 수정한 점수 파일 ESLint 및 제품 변경 diff 검사 통과. Growth 관련 10개 테스트 별도 통과.
- 공식 `quick_validate.py`: `uv run --with pyyaml python -X utf8 ...`로 **Skill is valid** 확인. 기본 Python에는 PyYAML이 없어서 일시 실행 의존성을 사용했으며 제품 의존성 파일은 변경하지 않았다.
- JSON, 역할 TOML 3개, 스킬/운영 문서의 로컬 링크 전부 유효하며 비공개 집계의 git check-ignore 확인을 완료했다. 스킬을 현재 환경에서 생성·구조 검증하고 첫 운영 실행 결과로 상태/기록을 갱신했다.
- 독립 하위 에이전트의 스킬 재호출은 파일 읽기 전 샌드박스 초기화 오류로 중단됐다. 따라서 자동 발견·호스트 role 로딩·독립 행동 실행은 미검증이다. 새 세션에서 `$rubricheck-owner daily`로 state/backlog를 읽고 다음 작업을 잇는지 확인한다. 실패한 호출을 성공으로 보고하지 않는다.
- 커밋·새 PR·preview·production 배포·블로그 게시: 수행하지 않음. 현재 작업은 로컬 변경이며 기존 production READY와 혼동하지 않는다.
- 기존 [보안 PR #8](https://github.com/keunyop/rubricheck/pull/8)은 runtime rollout 확인을 기다리는 open 상태다. 이번 실행에서 해소하지 않았고 중복 PR을 만들지 않았다.

## 확인한 근거와 한계

소스는 Next.js 16.1.6 / React 19.2.3 / TypeScript / Tailwind 4, Stripe, Supabase, Upstash Redis, OpenAI, Google Vision, Resend다. 실제 Stripe 가격과 코드 가격을 대조했다. 현재 USD 월 7.99, 연 59.99, 평생 99.99, 크레딧 10/25/60회는 4.99/9.99/19.99다. 기존 CAD 판매도 있어 통화를 합산하지 않는다.

Stripe live 구독·결제·환불·잔액거래와 Supabase의 admin summary·schema·growth 집계 읽기에 성공했다. 사업 집계는 공개 문서에 포함하지 않고 비공개 기록과 사용자 보고에서 다룬다. 사용자 summary의 knownUsers는 billing/free ledger 합집합이며 전체 가입자/MAU가 아니다. Stripe active와 Pro entitlement는 lifetime/trial 포함 여부가 달라 동일 지표가 아니다.

비교 기준은 Vancouver 완결 날짜 10/12–11/8 대 9/14–10/11이다. UTC 경계는 `[2026-10-12T07:00Z, 2026-11-09T08:00Z)`와 `[2026-09-14T07:00Z, 2026-10-12T07:00Z)`로 DST를 반영한다. 자체 growth 수집은 10/29부터여서 28일 완전 비교가 불가능하다. `evaluation_failed`는 access/validation/server를 포함하므로 전체를 AI 실패율로 해석하지 않는다. guest 완료와 account 완료를 함께 attempt별로 확인해야 한다. Vercel 오류 cluster의 first/last는 요청한 24h 범위를 벗어나므로 cluster count만으로 현재 실패율을 만들지 않았다.

Stripe 취소는 `canceled_at` 요청과 `ended_at` 실제 종료를 구분한다. 초기 비공개 snapshot의 canceledSubscriptions는 요청일 기준이므로 실제 이탈 계산에 쓰지 않는다. 정정된 정의와 수치를 별도 비공개 owner 기록에서 우선한다. Stripe 수수료는 일부 확인했지만 AI/OCR/인프라/에이전트 비용이 없어 순이익이나 평가당 총원가를 확정할 수 없다.

GSC 최신 property 조회와 GA4 property·key events·수익 제한·GSC 연결은 확인하지 못했다. 과거 GSC snapshot은 블로그 발행 전 자료라 블로그 효과 근거가 아니다. 공개 HTTP 및 Redis 직접 조회의 외부 실행 승인이 거절돼 중단했다. 사용자 과제 원문을 조회하지 않았다.

## 다음 실행

2026-11-10 daily에서 BILL-001 결제 실패 원인과 DATA-001 고유 평가 요청의 결과/실패 분류를 우선한다. 같은 결제의 재시도를 이탈 사용자 수로 계산하지 않는다. 기존 보안 PR의 runtime 검증 상태를 확인한다. GSC/GA4는 [최소 연결 또는 CSV](../../../.agents/skills/rubricheck-owner/references/measurement.md)를 받으면 SEO-001로 이어간다.

제품 변경은 preview/빌드/보호된 페이지 검증을 준비한 뒤 production 승인 단계로 넘긴다. 배포일이 없으므로 운영 성과 확인 시계를 시작하지 않는다. 배포 직후 합성 smoke, +7일 품질·수집, +28일 검색·전환을 관찰한다. 스킬 수동 실행이 충분히 검증된 후에만 예약 시각·예산·알림을 협의한다.
