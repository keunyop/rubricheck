# 두 번째 블로그: 서술형 초안을 비판적 분석으로 고치기

조사·작성일: 2026-11-02. 기존 [첫 글 기록](2026-11-02-blog-launch.md)의 선택을 고정 규칙으로 쓰지 않고 새 후보 6개를 비교했다. 수치는 [독립 집계 JSON](search-opportunities-20261102.json)에 보관한다.

## 선택한 글과 독자

- `/blog/descriptive-vs-critical-analysis`
- **Essay Too Descriptive? How to Add Critical Analysis**
- 영어, 호주 대학에서 에세이를 고치는 학생·국제학생을 우선 대상으로 하고 영국의 같은 피드백을 받은 학생을 함께 검토했다. 신규 검색 수요·시장 실험이다. 미국 첫 글과 다른 국가·고객 문제를 검토한 결과이며 발행 비율을 맞춘 선택은 아니다.
- 첫 문단에서 “증거가 허용하는 결론·한계·과제 질문과의 연결을 쓰라”고 답한다. 도서관 운영시간을 다룬 가상의 전후 문단, 루브릭 동사를 실제 문장으로 옮기는 방법, 5분 자기 점검을 제공한다. 사례와 루브릭 모두 허구임을 표시했다.
- 기존 `/blog/assignment-requirements-checklist`는 제출 요건의 존재 확인, 새 글은 한 문단의 추론 개선이다. `/how-to-use-a-rubric-to-check-an-assignment`는 전체 기준별 점검을 담당한다. 같은 검색 의도를 재작성하지 않는다.
- 실제 작업공간의 과제·지시사항·사용자 루브릭/일반 기준 입력과 피드백을 이용한다. `/workspace?start=general#rubric-checker`로 이동하며 자기 루브릭을 선택할 수 있다고 안내한다. 성적 보장, 자료 진위 검증, 공동작성 기여도 평가를 제공한다고 주장하지 않는다. 새로운 가격·무료 한도를 광고하지 않았다.

## 제공 데이터와 비교

최신 CSV: `doc/report/google_search_console_report_20261102`, 웹 검색, 2026-08-01~10-31. 더 최신 SEO 문서 없음. 실시간 GSC·GA4는 연결되지 않았고, 연결 후보 Windsor.ai는 미설치다. 기존 제안을 반복하거나 새 서비스를 도입하지 않았다.

| 항목 | 클릭 | 노출 | CTR | 평균 순위 |
| --- | ---: | ---: | ---: | ---: |
| 전체 | 2,051 | 13,440 | 15.26% | 약 6.77 |
| 최근 28일: 10/04~10/31 | 1,140 | 7,211 | 15.81% | 약 5.72 |
| 이전 28일: 09/06~10/03 | 549 | 3,630 | 15.12% | 약 5.57 |
| 말레이시아 | 1,040 | 2,176 | 47.79% | 1.78 |
| 미국 | 561 | 5,364 | 10.46% | 6.38 |
| 호주 | 125 | 1,129 | 11.07% | 10.22 |
| 영국 | 36 | 297 | 12.12% | 5.47 |
| 캐나다 | 84 | 607 | 13.84% | 3.91 |
| 데스크톱 | 1,517 | 10,405 | 14.58% | 6.81 |
| 모바일 | 478 | 2,859 | 16.72% | 6.85 |
| 태블릿 | 56 | 176 | 31.82% | 3.42 |

기간 평균 순위는 반올림된 일별 순위를 노출 가중한 근사값이다. 최근 클릭 증가는 CTR 급등만이 아니라 노출 증가와 함께 나타났다. 새 글은 이 기간 이후 작성되어 이 변화를 새 글 성과로 볼 수 없다. 국가·검색어·기기·페이지 표는 각각 독립 집계이며 결합하지 않았다. 호주의 기존 클릭이 `critical analysis` 검색에서 발생했다고 주장하지 않는다.

엄격한 브랜드 문자열 `rubricheck`는 47클릭/58노출/1.00위다. `rubric checker` 922/2,132/4.15위는 일반 도구 명칭과 브랜드 의도가 섞일 수 있어 전체를 브랜드로 분류하지 않았다. `check my essay against rubric` 0/159/22.08위는 낮은 순위와 의도를 함께 봐야 한다. `assignment criteria checker` 0/54/8.44위, `rubric feedback` 0/39/9.38위는 작지만 직접 제품에 연결되는 질문이다.

기존 `/assignment-rubric-checker` 71클릭/2,774노출/4.11위, `/essay-rubric-checker` 13/830/4.22위, `/rubric-feedback-tool` 2/991/7.33위. 도구를 찾는 질문에는 기존 랜딩이 있다. 페이지별 질문 교차자료 없이 낮은 CTR만 보고 새 블로그로 복제하거나 제목을 일괄 바꾸지 않았다.

## 여섯 후보와 채택 이유

모든 출처의 확인일: 2026-11-02. 4~6번은 기존 GSC 검색어 내보내기 밖에서 발견했다. 검색어 누락·익명화가 있으므로 ‘관측되지 않음’과 ‘수요 없음’을 구별한다.

| 질문·키워드 묶음 | 고객·국가·언어 / 구분 | 근거·의도·검색 결과에서 보완할 부분 | 실제 기능·판단·남은 불확실성 |
| --- | --- | --- | --- |
| 1. check my essay against rubric | 미국·말레이시아 영어 에세이 작성자 / 기존 | 0클릭/159노출/22.08위. 서비스 사용 의도이며 기존 essay 랜딩이 대응 | `/essay-rubric-checker` → workspace. 새 글 대신 랜딩의 입력·결과 설명과 쿼리별 유입 확인 우선. 국가별 해당 질문량 미확인 |
| 2. assignment criteria/instructions checker | 미국·캐나다 영어 학생 / 기존 | criteria 0/54/8.44위, instructions 0/46/11.39위. 첫 제출 체크리스트가 이미 설명 | 기존 첫 글·`/assignment-rubric-checker`. 별도 새 글 제외. 국가별 명칭 차이와 질문×페이지 자료 필요 |
| 3. rubric feedback / 다음 수정 우선순위 | 미국·말레이시아 영어 재작성 학생 / 기존 | feedback 0/39/9.38위. `/rubric-feedback-tool`가 이미 기능과 적용을 안내 | 기존 feedback 랜딩 개선 후보. 실제 평가 결과에서 가장 자주 이해하지 못하는 부분을 확인한 뒤 구체화 |
| 4. essay too descriptive / critical analysis example | 호주·영국 국제학생 및 대학 초년생, 영어 / 신규·선정 | [Monash](https://www.monash.edu/student-academic-success/excel-at-writing/how-to-write/essay/taking-it-further), [UTS](https://www.uts.edu.au/for-students/current-students/support/helps/self-help-resources/academic-skills/how-write-critically), [Leeds](https://library.leeds.ac.uk/info/1401/academic-skills/129/using-your-feedback/4)가 같은 피드백과 개선을 다룸 | 실제 루브릭과 수정 초안 점검. 가상 예문→평가기준→자기 초안의 문장 위치로 연결. 문제 존재·제품 적합성 높음, 검색 규모·전환 우위 미확인 |
| 5. reflective writing: description에서 analysis로 | 영국·말레이시아 교육·실습 과정 학생, 영어 / 신규 | [Edinburgh 성찰 글 구조](https://reflection.ed.ac.uk/reflectors-toolkit/producing-reflections/academic-reflections/structure), [Monash Malaysia 대학원 쓰기](https://www.monash.edu.my/library/about/news-and-events/articles/2026/academic-writing-for-postgraduates2). 단순 사건 기록과 배운 점 연결 필요 | 사용자가 준 성찰 과제 루브릭으로 텍스트 점검 가능. 차기 후보. 새 비판적 분석 글과 구별할 실습 사례·개인정보 제외 예시 필요. 특정 직종 역량 인증은 불가 |
| 6. group assignment individual contribution / peer evaluation | 호주·말레이시아 팀 과제 학생·담당자, 영어 / 신규 | [공개 질문](https://www.reddit.com/r/Monash/comments/1x3t578/what_do_you_guys_actually_do_when_your_group/), [Monash 공식 그룹 평가](https://www.monash.edu/learning-teaching/teachhq/Assessment/assessment-tasks/Design-and-manage-group-assessments). 기여도·공정성 문제 | 현재 글 점검만으로 실제 개인 기여도를 판단할 수 없음. 제품 조사 후보로 분리. 동료평가 수집·증거·권한 기능 없이 서비스가 해결한다고 홍보하지 않음 |

현재 클릭의 중심인 말레이시아와 첫 글 타깃 미국 외에 **호주·영국·캐나다**를 검토했다. 호주는 기존 유입과 현지 대학의 문제 설명이 있고, 영국도 유사한 피드백 용어를 사용한다. 호주식 `judgement`, `analyse` 문맥과 `unit`, 영국의 `tutor`·과제 질문을 이해할 수 있는 표현을 사용했다. 학교별 학기·제출 시점이 다르므로 전국 공통 마감일이나 동일 채점 기준을 상정하지 않았다. 국가별 번역 복제나 현지 성적 등급 보장은 없다.

## 경쟁·조사 한계

Google 국가 설정 결과 화면을 직접 열지 못했다. 대체 웹 검색 결과와 공식 대학 페이지를 사용했다. 직접 확인한 Google 순위·자동완성·People Also Ask로 제시하지 않는다. Trends·Keyword Planner 절대 검색량이나 예상 방문·전환 수치를 확보하지 않았고 만들지 않았다.

UTS 같은 공식 자료에도 전후 문단이 있다. 기존 결과가 모두 불충분하다고 주장하지 않는다. 이번 글은 다른 주제의 독자적인 가상 예문과 루브릭 동사의 문장별 증거, 5분 점검을 하나로 연결한다. 공식 문장을 복사하거나 기존 예문의 주제만 바꾸지 않았다. 지역 교육 자료는 문제의 존재와 용어 적합성 근거이며 시장 규모 측정값은 아니다.

## 구현·추적·발행

단일 `BLOG_POST`는 기존 호환성을 유지하고 `BLOG_POSTS`로 목록·라우트·메타데이터·사이트맵을 확장했다. 최초 글은 같은 경로와 발행일을 유지한다. 두 글 간 링크, 홈 자료 링크, assignment/essay/rubric-use/feedback 안내의 새 글 링크를 추가했다. 새 글은 기존 첫 글·사용법·essay 랜딩·실제 workspace로 연결한다. 내부 UTM 없음.

제목·설명·canonical·Open Graph/Twitter·BlogPosting·BreadcrumbList·사이트맵·발행/수정일을 추가했다. 새 글 소셜 locale은 `en_AU`, 본문은 영어다. 번역본이 없으므로 언어 대체 태그를 만들지 않았다. 없는 slug와 `/ko/blog`는 404다. 서버 HTML에 본문·표·전후 예문이 포함된다.

`publicGrowthPath`에 레지스트리의 새 경로를 허용해 기존 최초 유입 추적을 사용한다. 임의 경로나 개인정보 입력은 추가 허용하지 않았다. 가격·결제·평가 로직은 변경하지 않았다.

작업 전 배포 확인: `rubricheck.com` 운영 별칭은 Git `main`의 `f46f6bea203cff8e79522d30fa42f4c2b27fb8dd`, `READY`, 배포 `dpl_6BnyshRuEpYU7urfvmFAo2PqPMKb`. 따라서 첫 글은 이전 문서의 미배포 기록 이후 실제 배포되었다.

새 글은 운영 `.env.local`이 없는 별도 작업본에서 검증했다. 빌드의 기존 OpenAI 설정 검사는 실제 키가 아닌 명백한 fixture 문자열만 사용했고 AI API를 호출하지 않았다. 개발 브랜치를 `main`에 한 번 병합·push해 운영 배포했다. 커밋 `b908e79c24689b31fe4faefc889fd897b7be370e`의 배포는 `READY`이고, 새 글에 읽기 전용 GET 1회를 실행해 HTTP 200·본문·서비스 링크·canonical·구조화 데이터를 확인했다. 상세 결과는 [릴리스 기록](2026-11-02-blog-expansion-release.json)에 있다. 배포 후 기록은 추가 운영 배포를 만들지 않도록 로컬에만 저장했다.

### 완료된 로컬 검증

- 변경 파일 ESLint, Next production build, `tsc --noEmit`: 통과. 첫 제한 환경 빌드는 기존 Google Fonts 다운로드가 막혀 실패했고, 네트워크를 허용한 동일한 격리 작업본에서 완료했다.
- `node --import ./scripts/register-test-resolver.mjs --experimental-strip-types --test src/lib/growth.test.ts`: 7건 통과. 새 landing 허용 및 개인정보 제거 포함.
- `npm run test:seo`: 로컬 공개 URL 108개 통과. 본문·메타데이터·canonical·구조화 데이터·사이트맵·404 확인.
- `npm run test:blog:browser`: 기존 글과 새 글의 목록 이동, 모바일/데스크톱, 서버 HTML/JavaScript 없는 읽기, canonical, 내부 링크, workspace 진입, 404 통과. 새 글의 390/1280px axe WCAG A/AA 검사에서 위반 0. 브라우저 런타임 오류 0. 외부 요청은 차단하고 계정 API는 익명 fixture를 사용했다.
- 검증 시 `PLAYWRIGHT_MODULE`은 Quizeey의 `web/node_modules/playwright/index.mjs`, `AXE_MODULE`은 `web/node_modules/@axe-core/playwright/dist/index.mjs`의 절대 경로로 설정했다. 이 저장소의 기존 browser 스크립트처럼 사용 가능한 로컬 설치를 명시해야 한다. 별도 신규 서비스나 운영 자격증명은 필요하지 않다.
- 실제 DB/Auth, AI 평가 실행·평가 결과 생성, 결제, 운영 분석 수집은 제외했다. 글→작업공간 진입 통과를 평가 완료 검증으로 해석하지 않는다.
- 미리보기: [모바일](../verification/blog/critical-analysis-390.png), [데스크톱](../verification/blog/critical-analysis-1280.png). 접근성 검사 후 키보드 포커스로 나타난 skip link가 화면 상단에 보인다.

## 성과 측정과 후속 작업

- GSC: 새 URL과 `too descriptive`, `critical analysis`, `descriptive vs analytical`, `essay analysis example` 질문군을 확인한다. 호주·영국을 별도 필터로 보고 브랜드·일반 도구 질문과 구별한다. 기존 랜딩의 클릭 변화도 함께 보되 서로의 성과를 임의로 합치지 않는다.
- 기존 제품 분석: 최초 유입 landing이 새 글인 동의/정책상 수집 가능한 사용자 → `evaluation_started` → `evaluation_result_viewed`. 완료된 평가의 `attempt_id`를 연결하고 실패·게스트 `guest_preview_completed`·정식 `evaluation_completed`를 구분한다. workspace 링크 클릭만으로 평가 사용이 있었다고 세지 않는다. 실제 운영 이벤트 수집은 로컬 fixture 검증과 별개다.
- 배포 후 첫 28일은 발견·초기 관찰, 다음 28일과 비교. 새 글은 8~12주를 보며 학기별 과제 시기·국가·기기·순위 변동을 고려한다. 검색/서비스 이용 증가를 보장하지 않는다.
- 필요한 다음 자료: 국가×쿼리×페이지 GSC 내보내기 또는 읽기 연결, 새 landing별 평가 시작·결과 퍼널, 사용자가 어려워하는 루브릭 피드백 유형. 민감한 실제 과제 원문은 필요하지 않다.
- 다음 글: 과제용 reflective writing(영국·말레이시아)을 우선 재검토. 기존 essay/feedback 랜딩은 질문×페이지 근거를 얻어 개선. 팀 기여도 평가는 콘텐츠보다 제품 기능 검토를 먼저 한다.
