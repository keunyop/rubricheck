# Rubricheck 단일 운영 backlog

공개 가능한 기술 근거만 기록한다. 실제 사업/사용자 집계와 요청 ID는 비공개 운영 자료에서 조회한다. 완료와 배포는 별개다.

| ID | 우선순위 / 근거 | 최소 범위와 완료 기준 | 상태 / 다음 행동 |
| --- | --- | --- | --- |
| OPS-001 | 높음: 연속 운영 절차·상태 부재 | 한 owner skill, 5 modes, 권한·지표·단일 backlog, 독립 행동 검증 | 공식 형식·JSON/TOML·링크 검증 통과. 첫 운영 실행/기록 완료. 독립 호출은 도구 초기화 오류로 미완료 |
| OPS-002 | 높음: 다음 실행이 오늘 할 일을 자동 선택할 명시적 일지·규칙 부재 | 역순 일지, auto 선택, main release와 복구 절차, state handoff | 구현 중; skill·build·배포 검증 후 완료 |
| RELEASE-001 | 높음: QUAL-001/GROW-001이 검증됐지만 미배포 | main commit/push, Vercel READY, public smoke와 오류 확인 | 실행 중 |
| QUAL-001 | 높음: 허용된 소수 배점 2.5에서 점수 3 출력 재현 | Standard/Strict 최종 점수 상한 수정, 정수 배점/권한 유지, 두 회귀 통과 | verified_local; 전체 318 pass. preview/배포 대기 |
| GROW-001 | 높음: 공개 퀴즈 랜딩이 공통 계측 allowlist에서 누락 | 기존 pageview/attribution에 7개 언어 공개 경로 포함, 쿼리 제거·private 차단 유지 | verified_local; 관련10/full318 pass. preview/배포 대기 |
| SEC-008 | 배포 전 확인: 기존 runtime 보안 PR 차단 상태 | 기존 [PR #8](https://github.com/keunyop/rubricheck/pull/8)의 실제 runtime patch 재검증, 같은 PR 갱신 | open/외부 상태 확인 필요; 별도 신규 PR 만들지 않음 |
| BILL-001 | 높음: live Stripe 결제 실패 관측 | failure code·unique invoice/subscription·재시도/갱신 맥락을 개인정보 없이 분류; 접근 가능한 원인만 수정 | 원천 대조 완료: 과거 실패는 동일 청구의 반복 시도, 이후 결제 완료·구독 active. 신규 실패는 daily 재확인; 고객 연락·환불·재시도 자동 수행 금지 |
| DATA-001 | 높음: 수집 시작이 비교 기간 중간, 실패 이벤트 해석 필요 | expected access/validation와 server failure 분리, attempt별 guest/account terminal outcome reconcile; 완결 cohort 설정 | 미완료. GA4 폼·스크롤 이벤트는 2026-10-22 이후 중단됐고 측정 설정 변경과 일치하므로 전환 KPI로 사용 금지; first-party 결과로 확인 |
| SEO-001 | 중간: GSC의 기존 랜딩 노출 대비 낮은 클릭 | 최신 query×page 56일 집계로 검색 의도 확인 후 기존 랜딩 한 페이지 개선 | GSC 날짜별 비교·90일 페이지 표 확인. `/rubric-checker` 등 후보가 있으나 query×page가 없어 문구 수정 보류 |
| ACCESS-001 | 중간: GSC/GA4 최신 읽기 불완전 | [업로드 안내](../report/README.md)에 따라 최근 완결 56일 GSC·GA4 집계와 timezone/latest date/filters 확인 | 로컬 GSC 28일 비교·GA4 Events 분석 완료. GA4 landing/traffic sessions, key events와 manifest 누락; 원본은 Git 제외 |

| OPS-003 | 높음: owner가 수동 업로드 보고서를 자동 발견해야 함 | `doc/report/` 최신 유효 기간 판별, 원본 Git 제외, 28일 대 28일 비교, stale 상태 기록 | 보고서 탐색은 배포 완료 (`2358f9c`); 원본 Git 제외 규칙은 이번 실행에서 추가 |

ACCESS-001의 기본 수집 방식은 API 연결에서 [주간 보고서 업로드](../report/README.md)로 변경했다. 최신 유효 업로드가 있으면 API 연결은 요구하지 않는다.

## 변경 평가와 복구

QUAL-001 대상은 소수 배점 rubric 사용자, 근거는 실제 schema를 통과한 합성 재현이다. 성공 기준은 `0 <= score <= max_score`와 기존 정수 점수 계약 유지다. 예상 효과는 배점 초과 출력 제거이며 전환 개선 수치는 미측정이다. 추가 API 비용/마이그레이션 없음. 소수 점수 자체 지원은 별도 설계 과제다. 배포 전 실패 시 두 상한 변경과 회귀를 되돌린다. 배포 후 이상 시 승인된 롤백 절차로 직전 검증 배포를 복구한다.

GROW-001은 퀴즈 랜딩 유입을 기존 수집 범위에서 누락하지 않게 한다. 정확한 유입 집계가 목적이며 신규 수집 동의/이벤트/무료 한도는 변경하지 않는다. 기존 analytics 전송량의 누락 복구분은 증가할 수 있으나 금액 미측정이다. private 경로나 쿼리가 유출되면 즉시 배포 중단/복구한다. 공개 경로 한 항목과 회귀만 되돌릴 수 있다.

초기 완료 작업은 OPS-001·QUAL-001·GROW-001이다. BILL-001의 과거 실패는 원천 대조를 마쳤고, DATA-001의 고유 평가 결과는 미완료다. SEC-008의 기존 PR 상태는 별도 확인 대상으로 유지한다. 확인 기한은 [state](state.json)에 둔다.
