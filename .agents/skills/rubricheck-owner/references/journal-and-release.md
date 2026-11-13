# 일지, 오늘 할 일 선택, main 출시

## 자동 작업 선택

모드를 생략하거나 `auto`로 실행하면 사용자에게 오늘 할 일을 묻지 않는다. America/Vancouver 날짜를 기준으로 다음 자료를 읽는다.

1. `doc/operations/journal.md`
2. `doc/operations/state.json`
3. `doc/operations/backlog.md`
4. 최신 `doc/operations/runs/` 기록
5. `doc/operations/operating-model.md`

우선순위는 다음과 같다.

1. 진행 중인 incident, production 장애, 결제·데이터 유실, 실패한 배포, 배포 후 미검증 작업
2. 이전 실행에서 미완료됐거나 기한이 지난 작업과 `next_actions`
3. 아직 수행하지 않은 오늘의 daily baseline
4. `review_dates`와 마지막 완료 시각을 비교해 기한이 된 weekly/monthly 점검. monthly는 weekly 범위를 포함하므로 같은 날 중복 실행하지 않는다.
5. 근거와 접근이 준비된 backlog의 가장 가치 높은 작업

daily가 이미 완료됐고 weekly 또는 monthly가 기한이면 주기 점검을 먼저 선택한다. 작업 완료 시 실제 완료 시각과 다음 기한을 갱신해 특정 주기가 굶지 않게 한다. 각 후보를 사용자 영향, 수익·유지 영향, 근거 신뢰도, 지금 완료 가능성, 구현·운영 비용으로 비교한다. 한 실행에서는 완료할 수 있는 핵심 결과 하나를 우선한다. 할 일이 없으면 데이터와 차단 조건을 다시 확인하고 no-op을 기록하며 목적 없는 변경을 만들지 않는다.

매일 운영 실행에는 [콘텐츠 절차](content.md)의 블로그 글 1편을 더한다. America/Vancouver 날짜로 오늘 이미 게시된 글이 있으면 중복 발행하지 않는다. 장애 대응을 먼저 하되 글의 작성·검증·게시를 독립 작업으로 이어간다. 검증 실패나 배포 장애로 게시하지 못하면 초안과 차단 이유를 남기고 `published`로 표시하거나 다음 날 글로 소급하지 않는다. 스킬 유지보수만 요청받은 경우에는 콘텐츠 실행을 자동으로 시작하지 않는다.

## 일지 작성

`doc/operations/journal.md`는 사람이 빠르게 읽는 역순 색인이다. 실행 시작 시 진행 중 항목을 만들고 종료 시 다음을 확정한다.

- 날짜, run ID, 모드, 선택한 작업 ID와 선택 이유
- 조사·구현·검증·배포·운영 확인의 상태
- 변경 파일, issue/PR/commit/배포 링크, 복구 기준과 실제 복구 여부
- 확인한 지표의 기간·분모·한계. 비공개 수치나 고객 식별자는 공개 일지에 쓰지 않는다.
- 미완료 차단 원인, 다음 작업 ID, 재개 조건, 다음 확인 날짜

상세 근거는 `doc/operations/runs/YYYY-MM-DD[-suffix].md`에 둔다. `state.json`은 자동 재개용 source of truth이며 같은 실행에서 함께 갱신한다. 같은 날짜에 여러 번 실행하면 suffix를 붙이고 과거 기록을 덮어쓰지 않는다. 사실 정정은 정정 일자와 이유를 남긴다.

## main 직접 작업과 자동 배포

2026-11-09 사용자 지시에 따라 통상 변경은 별도 dev branch 없이 main에서 진행하고, 검증에 문제가 없으면 GitHub push로 연결된 Vercel production까지 반영한다.

main 직접 작업 조건:

1. 현재 checkout이 main이고 `origin/main`과 동기화됐다.
2. 작업 tree의 모든 변경이 이번 실행 또는 이미 검토된 owner 작업에 속한다.
3. diff에서 secret, 개인정보, 생성 산출물, 마이그레이션, 설정·권한 변경을 확인했다.
4. 변경 위험에 맞는 테스트, lint/typecheck, production build가 통과했다.
5. 기존 보안 차단 조건을 확인하고 해제 근거를 run 기록에 남겼다.
6. 저장소 스타일의 commit을 만들고 force push 없이 `git push origin main`을 실행한다.

파괴적 migration, 가격·환불·평가 정책 변경, 대규모 UI, 권한 확대, 소유권을 분리할 수 없는 dirty tree, 검토 없이 배포하기 위험한 보안 변경은 branch/PR 또는 별도 승인을 사용한다.

push 후 commit에 해당하는 Vercel 배포가 READY인지 확인한다. 공개 route와 변경된 흐름을 smoke test하고 최근 runtime error를 확인한 뒤에만 `verified_production`으로 기록한다. release가 원인인 치명 오류는 reset/force push 대신 release commit을 revert하고 main에 push한다.
