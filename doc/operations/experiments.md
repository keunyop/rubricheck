# 실험과 콘텐츠 성과

## 2026-11-22 검증 완료·게시 보류

| 작업 | 독자·질문·근거 | 검증 | 게시·후속 |
| --- | --- | --- | --- |
| CONTENT-DAILY 2026-11-22 | 영어 대학 과제 독자, 주 검색어 `essay conclusion example`. 본문에서 뒷받침되는 답·이유·한계·시사점으로 결론을 쓰는 가상 예시. 과거 영어 도구 의도와 제품 적합성에 따른 편집 가설이며 stale GSC11/08·GA4 11/09로 현재 국가별 수요·검색량을 추정하지 않음 | Harvard/Purdue 본문 확인, 본문 4단계 도식·동등 설명·실제 일반 기준 CTA, 작성자/PO 교차 검토, 격리 production build·TypeScript·lint·SEO130·320/390/1280px WCAG·날짜·가로 넘침 없음·No rubric 선택·noJS·내부 링크 통과 | `verified_local / awaiting_approval`. 실제 게시일 null, 운영 URL null, 계획 경로 `/blog/essay-conclusion-example`. 자동 승인 검토가 main push의 현재 명시 승인을 요구하며 실행 전 거부. 승인·운영 확인 후 실제 게시일+7일/+28일 검토;11/22 게시 시11/29·12/20, 지연 시 이동. 성과 null |

기존 no-rubric 글은 11/22 운영 본문·본문 도식·직접 일반 기준 CTA와 실제 No rubric 선택을 확인했다. 수정이 필요하지 않아 원발행·수정일11/15를 유지한다. 실제 색인과 검색/연결 결과 성과는 미측정이며12/13 완결 검토를 유지한다.

## 기존 실험

| 작업 | 가설 / 근거 | 변경 / 게시일 | 평가 기준 / 확인일 | 결과 |
| --- | --- | --- | --- | --- |
| QUAL-001 | 배점 초과 출력을 차단하면 평가 표시 신뢰성이 개선됨; 합성 재현 | 로컬 수정 2026-11-09 / 미배포 | 두 모드 score cap 회귀 통과; 배포 직후 합성 smoke, 7일 오류 검토 | 로컬318 pass; 운영 효과 미측정 |
| GROW-001 | 공개 퀴즈 랜딩 포함 시 기존 유입 측정 누락 제거 | 로컬 수정 2026-11-09 / 미배포 | 배포 즉시 pageview/query privacy, 7일 수집 확인, 28일 유입 추이 | 회귀10 pass; 전환 개선 주장 없음 |
| SEO-001 | 기존 검색 의도가 높은 페이지의 설명/예제 개선이 첫 사용에 도움 | 미착수 / 미게시 | 최신 query×page 확보 후 선택, 게시+7일 색인/+28일 검색·첫 사용 | 과거 GSC는 블로그 발행 전; 블로그 효과로 해석 금지 |

기존 콘텐츠 이력은 [SEO 기록](../seo/)을 재사용한다. 새 글을 이번 실행에서 작성/게시하지 않았다. 실험은 관찰 결과와 인과 효과를 구분하고 배포/게시 전에는 성과 시계를 시작하지 않는다.

## 2026-11-10 갱신

이전 표의 QUAL-001/GROW-001 미배포 표기는 후속 11월 9일 출시로 완료됐다. 정확한 배포는 [운영 일지](journal.md) 참조.

| 작업 | 가설과 이번 변경 | 확인일과 판단 | 상태 |
| --- | --- | --- | --- |
| SEO-001 | 영어 기존 rubric-checker의 실제 점검 목적 제목·설명과 일반 기준/무료 체험 안내가 도구 진입을 명확하게 한다 | 11/17 색인·모바일·CTA, 12/08 같은 기간 국가/페이지 클릭·첫 성공·두 번째 성공·검증 결제. US 우선, AU/CA 보조, MY 유지. 표본·계절·순위 영향 명시 | 구현; 출시 결과 최신 run/state 참조 |
| QUIZ-001 | 샘플 답변 직후 생성 CTA가 다음 행동을 쉽게 하고 공개 단계 계측이 발견 문제와 다음 단계 이탈을 구분한다 | 11/17 동의한 공개 노출/선택/샘플/생성 클릭 수집 점검; 관리자 생성/실패/학습 집계는 별도. 12/08 관찰, missing≠0 | 구현; 실제 모델/저장소 운영 집계 미확인 |
| GROW-002 | 첫 평가 뒤 결과 미확인의 큰 관측 구간은 게스트 첫 시도 검증 실패다. 검색·홈 진입이 시작자 규모의 주요 관측 경로다 | [이중 목표](runs/2026-11-14-dual-activation-goal.md): 성숙한 7일 첫 시작 코호트의 유효 결과 확인율 90% 이상과 확인 고유 사용자 기준선 2배 이상을 동시에 달성. 11/17 실패 범주·검색 경로 확인, 11/21 복구 변경 판단, 12/10 첫 성숙 출시 후 비교(출시 시각에 따라 연기), 2027-01-30 두 연속 코호트 판정 | 계측 production 확인; 목표 확정. 전환·유입 증가 미측정, 식별·동의 포괄률 미확인 |
| CONTENT-001 | 같은 루브릭으로 두 초안을 비교하는 실용 예제는 재사용 의도를 가진 검색 방문자에게 다음 평가 경로를 보여준다 | 2026-11-10 게시; 11/17 색인·링크, 12/08 같은 기간의 검색·첫/두 번째 평가·검증 결제 검토 | production 경로·canonical·BlogPosting·sitemap·목록 확인; 성과 미측정 |
| CONTENT-DAILY 2026-11-12 | 미국 영어권의 토론 답변 예시에서 독자가 자신의 응답 초안을 수업 루브릭으로 확인할 수 있다. 국가별 검색 노출은 관측됐으나 이 검색어의 미국 검색량은 미측정 | 11/12 게시; 11/19 색인·내부 링크·CTA, 12/10 동일 창 URL/검색어 클릭과 첫 성공 평가. 소표본·계절·순위 변화 구분 | production 글·목록·sitemap·CTA·canonical·BlogPosting 확인; 실제 검색·평가 성과 미측정 |
| CONTENT-DAILY 2026-11-13 | 미국 영어권 논증 과제의 반론 문단 예시가 독자의 초안·수업 루브릭 점검 경로를 보여줄 수 있다. 해당 검색어의 국가별 수요·전환은 미측정 | 11/13 게시; 11/20 색인·내부 링크·CTA, 12/11 동일 창 URL/검색어 클릭과 첫 성공 평가. 소표본·계절·순위 변화 구분 | 가상 예시·출처·제품 CTA와 production 글·목록·sitemap·canonical·BlogPosting 검증; 실제 성과 미측정 |

| CONTENT-DAILY 2026-11-14 | 영어권 essay evidence 설명의 실용 예시가 자신의 문단을 수업 루브릭으로 확인하는 다음 행동을 보여줄 수 있다. 해당 검색어의 국가별 검색량·전환은 미측정 | 2026-11-14 게시 | 11/21 색인·내부 링크·CTA, 12/12 완결 URL/검색어 클릭과 첫 결과 확인 경로. 소표본·계절·순위 변화 구분 | 본문·도식·lint·build·SEO 122경로·로컬 390/1280px 검증. production 글·목록·sitemap·canonical·BlogPosting·CTA와 배포 오류 로그 확인; 실제 성과 미측정 |
| CONTENT-DAILY 2026-11-15 | 루브릭이 없는 에세이 초안 점검 예시가 일반 기준의 한계와 다음 평가 경로를 명확히 할 수 있다. 해당 검색어의 수요·전환은 미측정 | 2026-11-15 게시 | 11/22 색인·내부 링크·CTA, 12/13 완결 URL/검색어 클릭과 첫 유효 결과 확인 경로. 소표본·계절·순위 변화 구분 | 가상 예시·출처·도식·lint·build·SEO 123경로·로컬 390/1280px·CTA 선택 상태 검증. production 글·목록·sitemap·alias·runtime 확인; 실제 성과 미측정 |
| CONTENT-DAILY 2026-11-16 | 루브릭 코멘트를 실제 문단 수정 계획으로 바꾸는 예시가 첫 평가 결과를 읽고 다음 행동을 고르는 데 도움을 줄 수 있다. 검색 수요·전환은 미측정 | 2026-11-16 게시, [글](https://rubricheck.com/blog/turn-rubric-feedback-into-revisions), 콘텐츠 커밋 `49bb705` | 11/23 색인·내부 링크·CTA, 12/14 완결 URL/검색어 클릭과 첫 연결 결과 확인 경로 | 가상 사례·본문 도식·출처·TypeScript·lint·build·SEO 124경로·모바일 렌더 검증. 사용자 승인 후 main push, Vercel READY, 공개 글·목록·사이트맵·workspace·canonical·BlogPosting·CTA 확인. 실제 성과 미측정 |
| CONTENT-DAILY 2026-11-17 | 루브릭의 행 배점·가중치·수준을 구분하는 예시가 모호한 기준표를 확인하고 첫 평가 입력을 준비하는 데 도움을 줄 수 있다. 해당 검색 수요·전환은 미측정 | 2026-11-17 게시, [글](https://rubricheck.com/blog/check-rubric-points-and-weights), 콘텐츠 커밋 `7b45bd5` | 11/24 색인·내부 링크·CTA, 12/15 완결 URL/검색어 클릭과 첫 연결 결과 확인 경로 | 가상 배점 도식·출처·TypeScript·lint·build·SEO 125경로·390px 렌더 통과. Vercel READY, 공개 글·목록·사이트맵·workspace·canonical·BlogPosting·CTA 확인. 운영 효과 미측정 |

11/10 배포를 기준으로 계획한 날짜이며 실제 배포일이 달라지면 7/28일 창도 이동한다. 보고서 처리 지연이 있으면 완결된 날짜까지만 사용한다. 예약 자동화는 생성하지 않았다.

## 2026-11-18 콘텐츠 게시

PO 통합 검증: 전체 339건·TypeScript·수정 lint·production build·SEO 126경로 통과. 320/390/1280px 본문 도식·표 키보드 스크롤·CTA 도착·canonical·BlogPosting·가로 넘침 없음 확인. 표의 작은 화면 넘침은 오늘 글에 한정된 스크롤 영역으로 수정했다. 사용자 명시 승인 후 소스 `8822c26`을 main에 push했고 Vercel READY·실제 도메인의 글·목록·sitemap·workspace·메타데이터·본문 도식·CTA·malformed JSON 400을 확인했다. 상태 `verified_production`, 게시일 2026-11-18, [운영 글](https://rubricheck.com/blog/reverse-outline-example). 11/25 수집·색인, 12/16 완결 기간 성과를 검토한다. 성과는 미측정이다.

| 작업 | 독자·검색 의도·선택 근거 | 내용·CTA·검증 | 게시·검토 |
| --- | --- | --- | --- |
| CONTENT-DAILY 2026-11-18 | 영어권 대학 과제 초안 독자, 미국 우선·AU/CA 보조는 과거 영어 도구 의도에 따른 편집 가설. 주 검색어 `reverse outline example`, 질문은 문단 순서와 빠진 논리를 찾는 방법. GSC 완결 2026-11-08, GA4 보고 2026-11-09까지의 과거 자료이며 해당 검색어 수요·국가별 전환은 미측정. 기존 문단 설명·루브릭 수정 글과 달리 초안 전체의 문단 역할·배열을 다룸 | 가상 자전거 수리대 에세이의 5문단 역개요, 4개 수정 결정 본문 도식·동등 설명, 내부 관련 글과 `/workspace?from=blog-reverse-outline#rubric-checker` CTA. Purdue OWL·WSU 원문 2026-11-18 HTTP 200·본문 확인. rubric/No rubric 입력·평가 점수 추정·AI/개인정보 문구를 현재 코드와 대조. 로컬 TypeScript·수정 파일 ESLint 통과, git diff --check 통과. 통합 build·SEO 126경로·320/390/1280px·표 키보드 스크롤·운영 공개 경로 검증 통과 | 게시일 2026-11-18, [운영 URL](https://rubricheck.com/blog/reverse-outline-example), 상태 verified_production. 11/25 색인·내부 링크·CTA 수집, 12/16 완결 URL/검색어 유입과 첫 연결 유효 결과 경로 검토. 게시가 늦어지면 7/28일도 이동. 검색·전환 효과 미측정 |

## 2026-11-19 콘텐츠 게시

| 작업 | 독자·검색 의도·선택 근거 | 내용·CTA·검증 | 게시·검토 |
| --- | --- | --- | --- |
| CONTENT-DAILY 2026-11-19 | 영어권 대학 과제 초안 독자, 미국 우선·AU/CA 보조는 과거 영어 도구 의도에 따른 편집 가설. 주 검색어 `synthesis paragraph example`, 질문은 두 출처를 한 주장에 연결하는 방법. GSC 완결 2026-11-08·GA4 보고 2026-11-09까지의 자료는 stale이며 최신 국가×검색어 수요·전환은 미측정. 기존 단일 근거 설명·반론·역개요 글과 달리 두 출처의 관계와 작성자의 추론을 구분함 | 제목 `Synthesis Paragraph Example: Connect Two Sources in One Argument`, 경로 `/blog/synthesis-paragraph-example`. 가상 도서관 자료 2개와 전후 문단, 본문 4단계 도식·동등 설명, 관련 글 3개와 `/workspace?from=blog-synthesis-paragraph#rubric-checker` CTA. Purdue OWL·UNC 원문 2026-11-19 HTTP 200·본문 확인. rubric/No rubric·AI 추정치·출처 직접 확인 안내를 현재 제품 문구와 대조. TypeScript·수정 TS/TSX ESLint·git diff --check 통과, React 검토(정적 서버 컴포넌트·의미 있는 제목/목록/그림 설명) 완료. 통합 production build·SEO 127경로·320/390/1280px 도식·가로 넘침 없음·canonical·BlogPosting·CTA 도착 검증 통과. 운영 글·목록·sitemap·workspace HTTP 200과 본문 도식·메타데이터·CTA 재확인 | 게시 승인 범위는 운영 위임, 실제 게시일 2026-11-19, 운영 URL https://rubricheck.com/blog/synthesis-paragraph-example, 상태 verified_production. 11/26 색인·링크·CTA, 12/17 완결 URL/검색어 유입과 첫 연결 유효 결과 경로 검토. 검색·전환 효과 null |

## 2026-11-20 콘텐츠 게시·기존 글 검토

| 작업 | 독자·의도·선택 근거 | 변경·검증 | 게시·확인 |
| --- | --- | --- | --- |
| CONTENT-DAILY 2026-11-20 | 영어 대학 과제 독자의 `source evaluation example`: 특정 주장을 출처가 어디까지 뒷받침하는가. US/CA 편집 가설이며 현재 국가별 수요 미측정. 기존 근거 설명/종합과 달리 원문 추적·방법·적합성·사용 범위를 다룸. 최신 GSC11/08·GA4 11/09는 stale | 제목 Source Evaluation Example: Decide What Your Evidence Can Support. 가상 강의녹화 설문·vendor 주장·평가 전후, 본문 4단계 도식·동등 설명·연구 메모·내부 링크. Purdue OWL2개·UW-Green Bay 원문11/20 확인. source/인용 검증·성적 보장 주장 없음. TypeScript·lint·build·SEO128·320/390/1280px·WCAG·No rubric 선택·운영 metadata/figure/CTA 확인 | 운영 위임으로11/20 게시, [운영 URL](https://rubricheck.com/blog/source-evaluation-example), `dedfe8e`, verified_production.11/27 색인 가능 경로·링크·CTA 수집,12/18 완결 URL/query와 첫 연결 유효 결과. 효과 null |
| CONTENT-DAILY 2026-11-13 후속 |11/20 기한인 반론 글의 색인 가능 경로·내부 링크·CTA 점검. 실제 검색 보고서가 게시 전 자료라 성과 판정 보류 | 기존 CTA 출처 태그와 직접 No rubric 선택 링크 추가. 원발행11/13 유지·수정일11/20. 로컬3개 화면·접근성·모드 선택 및 운영 HTML/날짜 확인 |11/20 수정 production 반영.12/11 완결 URL/query·첫 결과 경로 확인 유지. 실제 색인·효과 null |

## 2026-11-21 복구 판단·콘텐츠 게시

- GROW-002의11/21 출시 검토는 완료했다. 이미 검증된11/19 rubric recovery는 유지한다. 추가 원인별 구현은 code/안내노출·성숙후속 근거 부족으로 판정 불가이며,11/23 새 근거와 시간대 기준선을 점검한 뒤12/10 첫 성숙 비교를 진행한다. 목표·품질/과금 보호기준은 변경하지 않는다.

| 작업 | 질문·근거·차이 | 내용·검증 | 게시·후속 |
| --- | --- | --- | --- |
| CONTENT-DAILY 2026-11-21 | 영어 과제 독자 keyword `topic sentence examples`: 주제 이름에서 구체적 문단 요점으로 어떻게 고칠까? 국가별 수요·효과 미측정의 편집 가설. 기존 근거 해석·역개요 배열과 구분 | 가상 handover note2개·주제문4개·완성문단·본문4단계 도식/동등설명·체크리스트·내부링크. Harvard/Purdue 원문 현지11/21 확인. 실제 rubric/No rubric CTA와 제품·AI한계. TypeScript lint isolated build SEO129 320/390/1280px WCAG 도식 dates CTA 일반선택 통과; production 확인 | 지속위임으로11/21 게시, [운영글](https://rubricheck.com/blog/topic-sentence-examples), source `6677e6e`, verified_production.11/28 indexability·링크·CTA 수집,12/19 완결 URL/query·첫 연결 유효 결과. 효과 null |
| CONTENT-DAILY 2026-11-14 후속 |11/21 공개경로·도식·내부링크·CTA 검토. 게시 전 자료만 있어 실제 색인/효과 판정 보류 | 출처 태그·직접 일반 기준 선택 링크 보완, 원발행11/14 유지·수정11/21. 로컬3폭·접근성·선택상태와 production HTML/metadata 검증 |11/21 production 수정반영,12/12 완결 검색·첫 결과 확인 유지. 효과 null |


## 2026-11-22 게시 재개 승인

사용자가 현재 대화에서 “운영 배포 해주세요. 앞으로는 자동 배포해주세요”라고 명시 승인했다. 앞선 자동 검토 차단을 이 승인으로 재개한다. 검증된 소스와 원격 main의 일치를 다시 확인했고, main 커밋·push·Git 연동 운영 게시를 진행한다. 현재 상태는 authorized_release_in_progress이며 실제 게시일·완료는 운영 확인 후 확정한다. 향후 검증된 통상 변경도 별도 재승인 없이 배포하며 예약 실행은 생성하지 않는다.
