# Rubricheck 운영 일지

이 일지는 최신 실행부터 읽는 역순 색인이다. 자동 작업 선택의 기계 상태는 [state.json](state.json), 우선순위는 [backlog](backlog.md), 상세 근거는 [runs/](runs/)에 있다. 공개 저장소이므로 고객 식별자나 비공개 사업 집계는 기록하지 않는다.

## 2026-11-09 report-ingestion

- 모드: 운영 설정 변경
- 선택: OPS-003 보고서 업로드 방식 추가, ACCESS-001 API 연결 요구 제거
- 이유: GSC·GA4 API 연결 부담 없이 owner가 최신 집계 근거를 반복 사용할 수 있게 하기 위해서다.
- 현재 상태: `doc/report/` 규격과 주기, 개인정보 경계, 최신성 판정, owner 자동 탐색 규칙 작성. skill validator·JSON·링크·diff 검사 통과. 구현 커밋 `2358f9c`가 Vercel production `READY`이고 `rubricheck.com`에 연결됨.
- 사용자 작업: 매주 월요일 최근 완결 56일 GSC·GA4 보고서를 업로드한다. 월간 retention 보고서는 매월 첫 월요일에 추가한다.
- 상세 기록: [2026-11-09 report ingestion](runs/2026-11-09-report-ingestion.md)

## 2026-11-09 owner-journal-release

- 모드: auto
- 선택: OPS-002 운영 일지·자동 작업 선택·main 배포 위임 반영, QUAL-001/GROW-001 검증 후 출시, ACCESS-001 연결 안내
- 이유: 다음 실행의 자율성을 확보하고 이미 로컬 검증된 사용자 영향 수정을 production까지 완료하기 위해서다.
- 완료: 스킬 validator, 전체 테스트 318건, 변경 코드 lint, production build, 독립 검토, staged diff 검사 통과. 커밋 `881a59f`를 main에 push했다.
- 배포: Vercel production `dpl_EW6jxpfjUeAjiGorMRFoPQY3aNjT` READY. 홈과 `/ai-quiz-generator` 공개 smoke 통과, 배포별 error/fatal log 없음. project 오류 조회에서 malformed multipart 요청 2건이 `/api/evaluate` validation 단계에서 거부됐으며 이번 변경의 회귀 증거는 없음.
- 보안 확인: PR #8의 구형 Node 차단은 2026-10-28 이후 신규 배포가 패치된 Node를 사용한다는 [Vercel 공식 공지](https://vercel.com/kb/bulletin/node-js-security-advisory)로 해제했다.
- 다음 확인: 2026-11-10 daily, +7일 품질·수집, +28일 검색·첫 사용. 실제 GSC/GA4 계정 연결은 ACCESS-001 후속으로 남김.
- 호스트 정정: Git 잠금으로 오인될 수 있는 `.lock` 접미사 대신 `rubricheck-owner-active-run` 디렉터리로 동시 실행을 조정한다.
- 상세 기록: [2026-11-09 owner journal release](runs/2026-11-09-owner-journal-release.md)

## 2026-11-09 bootstrap

- 모드: weekly
- 완료: owner skill·역할·운영 기준·backlog·상태 구성, 소수 배점 상한 수정, 내장 랜딩 개인정보 분류 수정.
- 검증: 전체 테스트 318건, 공식 skill validator, JSON/TOML/링크 검사 통과.
- 출시: 당시 미커밋·미배포. 후속 RELEASE-001로 이관.
- 상세 기록: [2026-11-09 bootstrap](runs/2026-11-09-bootstrap.md)
