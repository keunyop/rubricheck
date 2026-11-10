# 2026년 11월 9일 보고서 업로드 방식 전환

사용자는 GSC·GA4 API 연결 대신 `doc/report/`에 최신 보고서를 주기적으로 업로드하기로 했다.

## 결정

- OPS-003: Owner는 실행 시작 시 `doc/report/`를 재귀적으로 확인하고 실제 보고 기간과 최신 완료일로 가장 최신 유효 자료를 선택한다.
- ACCESS-001: API 연결은 필수 조건에서 제외한다. 최신 보고서가 있으면 API보다 우선 사용한다.
- 주간 기본은 최근 완결 56일이다. 최근 28일과 직전 28일을 같은 정의로 비교한다.
- 월간에는 최근 90일 retention/cohort를 추가한다.
- 공개 저장소에는 집계 자료만 두고 사용자·결제 식별자와 원문은 금지한다.

## 필요한 사용자 작업

매주 월요일 GSC 전체 export와 GA4 landing page, traffic acquisition, events/key events CSV를 올린다. 매월 첫 월요일에는 retention/cohort를 추가한다. 각 업로드에 기간·timezone·필터·최신 완료일을 적은 `REPORT.md`를 포함한다.

## 상태

- skill·측정 기준·업로드 안내: 구현 완료
- 첫 최신 보고서: 대기
- skill validator·JSON·링크·diff 검사: 통과
- 커밋·배포: 대기
