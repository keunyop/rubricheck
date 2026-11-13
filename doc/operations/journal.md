# Rubricheck 운영 일지

이 일지는 최신 실행부터 읽는 역순 색인이다. 자동 작업 선택의 기계 상태는 [state.json](state.json), 우선순위는 [backlog](backlog.md), 상세 근거는 [runs/](runs/)에 있다. 공개 저장소이므로 고객 식별자나 비공개 사업 집계는 기록하지 않는다.

## 2026-11-12 daily-blog

- 요청: owner auto/daily에 매일 글 1편을 추가하고 오늘 글을 즉시 게시. 현지 날짜별 중복 확인과 국가·검색어 근거 판단을 지침에 넣었다.
- 미국 영어권의 `discussion board response example` 글을 게시했다. 미국 검색 유입과 기존 콘텐츠 공백을 근거로 선택했으며 이 검색어의 국가별 검색량·전환은 미측정이다.
- 상태: `verified_production`. main `ec173af6`의 Vercel 배포 READY, 운영 글·목록·sitemap·CTA 및 canonical·BlogPosting 확인. build·SEO 120·모바일/접근성 브라우저·성장 경로 테스트 통과.
- 다음: 11/19 색인·링크·CTA, 12/10 완결된 검색·첫 평가 경로 검토. 11/12의 일반 daily 운영 점검은 별도 미완료. 상세는 [실행 기록](runs/2026-11-12-daily-blog.md).

## 2026-11-11 daily-grading-cleanup

- 모드: auto에서 기한이 된 daily 선택, 사용자 요청으로 기존 관리자 평가 실패 기록의 해결 여부와 삭제를 추가 확인했다.
- 기존 항목 모두 각각의 게스트 방문 흐름에서 후속 평가 결과 생성이 확인됐다. 사용자 요청에 따라 기존 기록과 보관 원본을 ID별 삭제했고, 인증된 production 목록 재조회가 비어 있음을 확인했다. 원래 기준표의 배점 문제까지 해결됐다는 뜻은 아니다.
- 신규 보관함 항목과 새 server terminal 실패, 새 피드백, 새 결제 웹훅 실패는 관측 범위에서 없었다. runtime 개별 로그는 보존 기간 제한이 있었다. 코드 변경·배포 없음.
- 다음: 11/12 daily 신규 실패·피드백·결제 점검, 11/17 콘텐츠·퀴즈·영어 랜딩 수집 확인. 상세는 [실행 기록](runs/2026-11-11-daily-grading-cleanup.md).

## 2026-11-10 admin-blog-publish

- 모드: 사용자 지침에 따른 daily + incident + content. 기존 관리자 비밀키 인증을 통해 평가 실패·퀴즈 집계 읽기 경로를 확인했다. 이메일 인증 우회용 무인증 경로를 추가하지 않았다.
- 평가 실패 보관함의 구조화 오류를 원본과 로그로 대조했다. 항목 배점 합계와 총점이 충돌하거나 항목별 배점이 빠진 기준표가 확인됐다. 임의 점수 보정 없이 7개 언어 사용자 안내에 배점 점검·배점 내역 확인을 추가했다.
- 신규 영어 글의 실제 블로그 route, 메타데이터, 내부 CTA, sitemap을 구현했다. 사용자 상시 게시 위임에 따라 별도 승인 없이 검증 후 production에 게시한다. 세부 상태는 [실행 기록](runs/2026-11-10-admin-blog-publish.md)에 남긴다.
- 상태: `verified_production`. 전체 321·SEO 119경로·lint·production build·격리 브라우저 검사 통과. main 커밋 `c7b5f18`의 Vercel 배포가 READY이고 운영 도메인의 글·목록·canonical·BlogPosting·sitemap을 확인했다. 11/17 색인·새 평가 실패, 12/08 콘텐츠/재사용/구독 성과를 재검토한다.

## 2026-11-10 grading-content

- 모드: 사용자 후속 요청에 따른 daily + incident + content. 선택: GRADE-001 운영 실패 분류와 업로드 예외 수정, CONTENT-001 신규 글 작성.
- 결과: malformed multipart가 평가 전 500으로 기록되던 경로를 400·재시도 안내로 수정했다. 루브릭 총점 불일치 실패는 후속 성공을 대조했으나 원본 없이 원인을 확정하지 않았다. 관리자 보관함 전체는 미열람이며 해결 0건/전체 해결로 단정하지 않는다.
- 새 영어 글 [초안](../seo/drafts/2026-11-10-compare-essay-drafts-with-rubric.md)을 오늘 작성·검토했다. 공개 게시는 별도 승인 전까지 보류한다.
- 상태: `verified_production`; focused 34, lint, build 통과. 커밋 `d5626b6` production READY·도메인 연결, 합성 malformed 요청 400과 배포 warning 확인, 배포별 error/fatal 0건. 실제 신규 업로드 성공률과 관리자 보관함 전체는 미확인. 상세 [실행 기록](runs/2026-11-10-grading-content.md).

## 2026-11-10 growth-quiz

- 모드: weekly + daily 후속. 사용자 요청: 새 보고서를 반영해 국제 유입·구독 성장 및 퀴즈 미사용 원인을 조사하고 개선 실행.
- 선택: ACCESS-001 새 보고서 재분석, SEO-001 기존 랜딩 개선, QUIZ-001 발견·첫 사용·측정 점검.
- 상태: `verified_production`. 신규 보고서·동의 기반 first-party·구독 스냅샷 분석, 영어 랜딩 안내와 퀴즈 샘플→생성 CTA/공개 계측 구현. 전체320·브라우저14그룹·수정 lint·build·독립검토 통과.
- 커밋 `6a97aba` production READY·도메인 연결·운영 smoke6그룹 통과, 배포별 error/fatal 기록 없음. 운영 퀴즈 관리자 집계와 GA4 실제 수신은 미확인. 11/17 수집/첫 사용 경로, 12/08 28일 성장·재사용·구독 검토. 상세: [growth-quiz](runs/2026-11-10-growth-quiz.md).

## 2026-11-10 report-analysis

- 모드: auto 후속. 선택: ACCESS-001 보고서 분석·Git 제외, DATA-001 GA4 이벤트 정의 점검, SEO-001 다음 근거 정리.
- 결과: 업로드 원본을 Git에서 제외하고 owner 스킬의 분석 중단 규칙을 제거했다. GSC 두 28일 구간 비교를 완료했고 검색 클릭·노출·CTR 개선을 확인했다. GA4 폼·스크롤 이벤트는 측정 변경 이후 보이지 않아 제품 전환 지표로 사용하지 않는다.
- 상태: Git 제외 규칙·skill validator·JSON·diff·production build 검증 통과. GA4 랜딩·유입 sessions, key events, property timezone·threshold와 GSC query×page는 미확인. 상세 수치는 Git 제외 비공개 기록에 보관.
- 다음: 필요한 보완 export 확보 후 한 기존 랜딩 개선; first-party 고유 평가 결과 점검.
- 상세 기록: [2026-11-10 report analysis](runs/2026-11-10-report-analysis.md)

## 2026-11-09 first-report

- 모드: auto. 현지 2026-11-09에 시작해 2026-11-10에 종료.
- 선택: ACCESS-001 새 업로드 점검, BILL-001 결제 실패 원천 대조.
- 결과: 공개 저장소의 GA4 업로드 메타데이터에서 개인 계정명을 발견해 보고서 분석과 커밋을 보류했다. Stripe live에서는 이전 실패 기록이 동일 청구의 반복 시도이며 이후 결제 완료·구독 active임을 확인했다.
- 상태: GSC/GA4 지표는 미측정. 코드 변경·배포 없음. 비공개 상세는 Git 제외 기록에 보관.
- 재개: 식별 정보를 제거한 보고서와 기간·필터 manifest가 필요하다. 다음 daily에는 신규 결제 실패와 평가 결과를 확인한다.
- 상세 기록: [2026-11-09 first report](runs/2026-11-09-first-report.md)

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
