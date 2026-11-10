# Rubricheck 운영 기준

목표는 안정적인 평가 → 첫 성공 → 재사용 → 유료 구독 → 유지다. 기존 구현·측정·관리 화면을 재사용하며 작은 변경으로 검증한다. 공개 저장소이므로 이 폴더는 비민감 절차와 구현 상태만 보관한다.

## 호출과 기록

저장소에서 `$rubricheck-owner daily`, `weekly`, `monthly`, `content`, `incident [문제]`를 사용한다. 생략은 weekly다. “Rubricheck 오늘 운영 점검해줘”, “Rubricheck 이번 주 성장 작업 진행해줘”도 description에 포함했다.

[스킬](../../.agents/skills/rubricheck-owner/SKILL.md) → [운영 일지](journal.md) → [state.json](state.json) → [backlog](backlog.md) → state가 가리키는 최신 [실행 기록](runs/) 순서로 재개한다. owner는 사용자가 오늘 할 일을 다시 알려줄 때까지 기다리지 않고 일지와 기한에서 auto 작업을 선택한다. 실험/콘텐츠는 [experiments.md](experiments.md)에 유지한다. 스킬이 선택 목록에 없으면 세션을 다시 시작하거나 파일 경로를 지정해 읽도록 요청한다.

비공개 집계와 cursor는 Git에서 제외된 `.growth-local/owner/`에 둔다. 첫 데이터 감사는 `.growth-local/data-audit-20261109*`에도 기록한다. secret·이메일·과제 원문을 운영 문서나 PR에 복사하지 않는다. 비공개 자료가 없는 새 기기는 원천 재조회로 시작하며 공개 state만으로 미완료 작업은 이어받는다.

## 권한 원장

근거: 2026-11-09 사용자 최초 운영 위임. 이미 허용된 일에 재승인을 요구하지 않는다.

| 범위 | 상태 | 조건 |
| --- | --- | --- |
| 읽기·분석·재현·저장소 수정·테스트·문서/콘텐츠 초안·스킬 | 승인됨 | 기존 변경 존중, 개인정보 최소화 |
| 기존 저장소 이슈·draft PR | 승인됨 | 중복 확인, 비민감 내용만 |
| preview | 승인된 범위에서 가능 | 대상/환경 확인, 서비스 접근 권한 준수 |
| main 직접 commit/push·Git 연동 Vercel production | 지속 위임 승인 | 2026-11-09. 통상 변경은 main 동기화·diff 검토·테스트/build 통과 후 push하고 배포/smoke 확인 |
| 공개 블로그 게시 | 지속 위임 미확인 | 검증된 본문·링크·모바일 결과를 준비한 뒤 게시 승인 |
| 가격·무료 한도·구독·환불·크레딧·파괴적 변경·권한 확대·대규모 UI/평가 정책 변경·외부 연락 | 별도 승인/명시적 정책 필요 | 초안과 영향·비용·복구 방법 준비 |
| 새 유료 서비스·광고·예산 초과 | 승인 없음 | 실제 추가 비용이 있는 작업은 먼저 범위/견적 제시 |
| 예약 실행 | 등록 승인 없음 | 현재 등록 0건, 수동 실행부터 검증 |

main/production 지속 위임은 [owner 출시 절차](../../.agents/skills/rubricheck-owner/references/journal-and-release.md)를 따른다. 고위험 migration, 가격·정책·권한·대규모 UI/평가 정책 변경은 여전히 branch/PR 또는 별도 승인이 필요하다. 블로그 게시 지속 위임은 아직 없다. 금액 상한은 미설정이며 새로운 유료 계약이나 대량 모델 실행 권한을 뜻하지 않는다.

## Grading failures 일일 분류

PO daily 점검에서 관리자 실패 보관함의 신규 항목과 최근 24시간 평가 요청의 최종 결과를 함께 확인한다. 보관함은 7일 진단 이력이며 미해결 작업 큐가 아니다. 요청별 `stage`·`code`·HTTP 상태·배포 시각을 대조하고, 같은 사용 흐름의 후속 성공 여부를 확인한 뒤 재현 가능한 원인을 우선 수정한다. 한 요청의 중복 로그 줄을 별도 실패로 세지 않고, 4xx 루브릭 구조화 실패도 사용자 영향에서 제외하지 않는다.

관리자 인증이 없으면 Vercel 개별 runtime log와 first-party terminal 집계로 가능한 범위를 조사하고, 보관함의 건수·원본·해결 상태는 `미확인`으로 남긴다. 직접 Redis 접근이나 자격 증명 출력으로 우회하지 않는다. 다음 daily의 확인 기한과 필요한 최소 관리자 요약(최근 7일 건수, 최신 항목의 시각·단계·코드)을 state와 backlog에 명시한다. 원본·이메일·요청 ID는 공개 기록에 넣지 않는다. 보관 기간 경과나 수동 삭제를 해결의 근거로 사용하지 않는다.

## 접근 현황

2026-11-09 확인. '추가 연결 필요'에는 인증 외에 이번 실행에서 거절/차단된 조회도 이유와 함께 표시한다.

| 대상 | 상태 | 실제 확인 범위 / 남은 일 |
| --- | --- | --- |
| GitHub/소스 | 접근 가능 | keunyop/rubricheck public, 기본/현재 main, 시작 HEAD 90529ae, 시작 시 clean |
| 테스트/CI | 접근 가능 / CI 설정 미확인 | test:all·lint·build 스크립트 있음; 로컬 전체 테스트 실행. 저장소에 GitHub workflow 없음. 배포 build가 테스트 실행을 보장하지 않음 |
| Vercel | 접근 가능 | rubricheck project, 최근 production READY, Node 24.x 설정. 정확한 runtime patch는 확인 안 됨. preview는 custom domain 외 SSO 보호 |
| 현재 배포 | 접근 가능 | 기존 dpl_DDPKYWKZEhpV7yoFW4XYDeiAiin5 확인. 이번 변경 배포 아님 |
| Feedback/Grading failures | 추가 연결 필요 | Redis 기반 `/admin`과 관리자 API 코드 확인. 직접 Redis 조회 외부 실행 거절; 운영 inbox 내용/미해결 건수는 미확인 |
| 애플리케이션 오류 | 접근 가능(부분) | Vercel 오류 cluster 읽기 성공. cluster first/last는 요청 window를 벗어나므로 고유 실패율 산출에 쓰지 않음 |
| 문서/모델 사용비 | 추가 연결 필요 | 모델 설정과 실패 분류 코드만 확인. 토큰·OCR billing/전체 비용 미확인 |
| Supabase | 접근 가능 | MCP 읽기 전용 admin summary/schema/growth aggregate 성공. 원문 조회 없음 |
| Stripe | 접근 가능 | live 구독·가격·charges·refunds·balance transactions 확인. 상세 합계는 비공개 기록 |
| GSC | 로컬 보고서 분석 가능 | 2026-11-08까지의 날짜별 export로 28일 비교 가능. query×page와 필터/timezone manifest는 없음; property API 직접 조회 없음 |
| GA4 | 로컬 보고서 부분 분석 가능 | 2026-11-08까지의 Events export 확인. 랜딩·유입별 sessions와 property timezone·threshold·key events 설정은 미확인; 직접 조회 없음 |
| 블로그 | 접근 가능 | src/config/blog.ts와 app/blog, 기존 doc/seo 절차. 이번 공개 HTTP 확인은 외부 실행 거절 |

GSC/GA4는 [읽기 연결 절차](google-analytics-access.md)를 따른다. 해당 property만 GSC Restricted/`webmasters.readonly`, GA4 Viewer/`analytics.readonly`로 연결하며 비밀번호·token·JSON key를 채팅이나 저장소에 넣지 않는다. 연결이 어려우면 [필드와 기간](../../.agents/skills/rubricheck-owner/references/measurement.md)에 맞춘 최신 완결 56일 CSV를 제공한다.

## 모델과 도구

실제 확장 번들 버전: `codex-cli 0.164.0-alpha.11.1`, VS Code `openai.chatgpt-26.51021.22027-win32-x64`. 현재 도구의 모델 카탈로그는 gpt-6.1-sol / gpt-6-astra 등을 제공한다. 첫 CTO·Growth·Data 하위 에이전트는 실제 `gpt-6.1-sol`, `high`로 실행했다. 단순 집계/초안은 medium, 복잡 장애/설계는 사용 가능한 astra를 고려한다. 루트 세션 모델 변경은 수행하지 않았다.

공식 [skill 규격](https://learn.chatgpt.com/docs/build-skills)과 [custom agent 규격](https://learn.chatgpt.com/docs/agent-configuration/subagents)을 2026-11-09 열람했다. 저장소 스킬은 `.agents/skills`, standalone role TOML은 `.codex/agents`에 둔다. [역할 설정](../../.codex/agents/)은 name/description/developer_instructions/model/effort를 포함한다. 현재 collaboration API는 TOML role 선택을 노출하지 않아 실제 위임은 명시적 프롬프트로 수행했다. TOML 작성/구문 검증과 호스트 로딩 검증을 혼동하지 않는다.

## 예약안

현재 Local Agent Host와 cloud 제공자가 등록 기능을 노출하고 자동화는 비어 있다. 저장소는 public이므로 private/internal 저장소가 필요한 cloud 자동화는 현재 대상에 맞지 않는다. 로컬 후보: 평일 09:00 daily, 월요일 09:00 weekly로 중복을 피하도록 구성; 시간대 America/Vancouver. 수동 검증 후 실행당 우선순위 1건·모델/API 지출 상한·인증 유지·PC 실행 조건·실패 알림 수신 채널을 정한다. 실패 결과는 실행 이력에 남기며 외부 알림 전송은 별도 허용 채널을 확인한다. 아직 자동화 생성/활성화하지 않았다.
