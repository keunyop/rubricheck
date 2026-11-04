# Quiz Generator: 강의 자료를 복습 문제로 바꾸기

조사·작성일 2026-11-04. 사용자 지정 주제는 Quiz Generator이며 두 사이트 각각 새 글 한 편을 요청했다. 이전 두 글의 URL·발행일은 유지한다.

## 선택한 글과 제품 연결

- `/blog/quiz-generator-from-notes` — **Quiz Generator from Notes: Turn a PDF into Useful Practice**
- 영어. 캐나다 대학 초년생·강의 노트로 중간/기말 평가를 준비하는 학생을 우선 가설로 삼고, 영국의 revision 독자와 호주 학생도 검토했다. 국가별 검색량 우위나 전환율을 확인한 선택은 아니다.
- 기존 미국 제출 체크리스트, 호주 비판적 글쓰기와 다른 **신규 기능·신규 검색 의도 실험**이다. 기존 주력 클릭 국가인 말레이시아 및 미국 외 캐나다·영국을 검토했다. 제품 영어와 강의 자료 입력이 맞고, 현지 시험 문제은행이나 학교별 일정에 의존하지 않는다.
- 첫 문단에서 자료 범위 선택 → 생성 → 답 시도 → 원문 검증 → 오답 복습으로 답한다. 직접 만든 실험 노트와 객관식/참거짓 예시, 부족한 근거로 만들 수 없는 질문, 자료 품질 체크리스트를 포함한다. 사례는 가상이며 AI 실제 출력이나 성과 사례가 아니다.
- `/ai-quiz-generator`는 도구 탐색 의도, 새 글은 자료 준비·생성 결과 검증·복습 방법을 담당한다. 동일 도구 키워드의 랜딩을 복제하지 않는다.
- CTA `/quizzes?view=create`. 비로그인 사용자는 `/workspace?start=login&returnTo=...`를 통해 생성 목적지를 유지한다. 선행 과제 평가가 필요하다고 안내하지 않는다.
- `src/lib/quizTypes.ts`, `app/quizzes/QuizCreator.tsx`, `QuizStudy.tsx`, `app/components/QuizOverview.tsx`, `src/lib/quizStore.ts`로 파일 유형·한도·유형·계정 조건·오답 복습을 확인했다. 무료 생성 총 10문항(월 초기화 없음), Pro 1회 최대 20문항 및 월 생성 한도 없음, 채점 크레딧 별개. 생성된 문항은 원문과 대조하도록 안내한다. 단답형 채점·자동 성적 향상·시험 예측을 광고하지 않는다.

## 데이터와 해석

최신 제공 내보내기는 `doc/report/google_search_console_report_20261102`, 2026-08-01~10-31 웹 검색이다. 이후 보고서 없음. 실시간 GSC/GA4 연결 도구 없음. [재확인 기록](2026-11-04-blog-research.json)에 국가·기기 독립 집계와 이번 검색어 검사를 저장했다. 동일 파일의 총계·28일 비교는 [이전 분석](2026-11-02-blog-expansion.md)과 동일하다.

| 구분 | 클릭 | 노출 | CTR | 평균 순위 |
| --- | ---: | ---: | ---: | ---: |
| 전체 | 2,051 | 13,440 | 15.26% | 약 6.77 |
| 최근 28일 10/04~10/31 | 1,140 | 7,211 | 15.81% | 약 5.72 |
| 이전 28일 09/06~10/03 | 549 | 3,630 | 15.12% | 약 5.57 |
| 말레이시아 | 1,040 | 2,176 | 47.79% | 1.78 |
| 미국 | 561 | 5,364 | 10.46% | 6.38 |
| 캐나다 | 84 | 607 | 13.84% | 3.91 |
| 영국 | 36 | 297 | 12.12% | 5.47 |
| 호주 | 125 | 1,129 | 11.07% | 10.22 |

데스크톱 1,517/10,405, 모바일 478/2,859, 태블릿 56/176(클릭/노출). 기간 순위는 일별 노출 가중 근사값이다. 국가와 검색어를 조인하지 않았고 캐나다 클릭을 퀴즈 수요로 해석하지 않았다. 신규 기능 이전 기간이라 quiz/flashcard/notes 문자열은 검색어 내보내기에 없다. 이는 시장 수요 0이나 신규 글 성과가 아니다.

명시 브랜드 `rubricheck` 47/58/1.00위. `rubric checker` 922/2,132/4.15위는 일반 도구 의도와 브랜드 의도가 섞일 수 있다. `assignment criteria checker` 0/54/8.44위, `rubric feedback` 0/39/9.38위는 제품 연결성이 있으나 기존 랜딩과 글이 대응한다. 낮은 CTR만 보고 중복 글을 만들지 않았다.

## 여섯 후보 비교

확인일 모두 2026-11-04. 3~6은 기존 GSC 문자열 밖의 후보다. 관측 부재는 익명화·표본·신규 기능 영향을 받을 수 있다.

| 후보·핵심 질문 | 고객·국가·언어 / 구분 | 근거·의도·보완점 | 실제 연결·판단·불확실성 |
| --- | --- | --- | --- |
| 1. assignment criteria checker | 미국·캐나다 영어 과제 학생 / 기존 | 0/54/8.44위. 제출 요건 확인은 기존 글이 설명 | `/assignment-rubric-checker`, 첫 글. 새 글 제외. 쿼리×페이지 자료를 얻어 랜딩 개선 검토 |
| 2. rubric feedback 다음 학습 | 말레이시아·미국 영어 재작성 학생 / 기존 | feedback 0/39/9.38위. 이미 feedback 랜딩과 critical-analysis 글 존재 | `/rubric-feedback-tool`·기존 글. 새 글보다 실제 피드백 이해 문제 조사 우선 |
| 3. quiz generator from notes / PDF to quiz | 캐나다·영국 강의 복습 학생, 영어 / 신규·선정 | UBC 학습 팁, Melbourne 회상 연습 안내, 공개 검색에 노트→퀴즈 도구 다수. 도구 설명에 더해 입력 검증과 원문 대조 실습 제공 | `/quizzes?view=create`. 소스 선택·해설·오답 복습과 직접 연결. 제품 적합성 높음, 국가별 규모 미확인 |
| 4. lecture slides to questions / unreadable PDF | 영국·캐나다 강의 슬라이드 학습자, 영어 / 신규 | 생성기 검색 결과와 코드의 텍스트 추출·범위 선택. 불완전한 슬라이드 문제를 새 글 일부로 해결 | 동일 생성 기능. 별도 중복 글보다 추출 실패 사례·원인 자료가 모이면 전용 가이드 검토 |
| 5. turn assignment feedback into revision quiz | 호주·말레이시아 영어 학생 / 신규 | 실제 assignment·improvements 입력 기능 확인. 일반 노트 업로드와 다른 사용 맥락 | 과제 결과→퀴즈. 다음 후보. 실제 개선 주제 선정 예시와 사용자 동선 자료 필요; 모든 글쓰기 역량을 객관식으로 평가할 수 없음 |
| 6. flashcards / short-answer quiz from notes | 캐나다·영국 영어 자기시험 학습자 / 신규 | Leeds의 자기시험·flashcards 안내 및 생성기 검색 결과의 다양한 형식 | 현재 생성 유형은 객관식·참거짓. 플래시카드/단답형 자동채점은 제품 개선 후보로 분리. 미지원 기능으로 유입시키지 않음 |

## 공개 근거와 경쟁 조사

- [UBC Science 학습 팁](https://science.ubc.ca/students/blog/study-tips-from-spac): 캐나다 학생 맥락과 연습문제 활용.
- [Melbourne exam revision](https://students.unimelb.edu.au/academic-skills/study-skills/exam-preparation/exam-revision): 노트를 덮고 회상하기·분산 학습.
- [Leeds revision strategies](https://library.leeds.ac.uk/info/1401/academic-skills/107/revision-and-exams/3): 영국 용어와 자기시험 방식.
- 웹 검색 `quiz generator from notes PDF study questions`에서 [SyncStudy](https://www.syncstudy.app/tools/ai-quiz-generator), [Tutoremy](https://www.tutoremy.ai/tools/quiz-maker), [SimpleQuizMaker](https://simplequizmaker.com/quiz-from-lecture-notes) 등의 도구 페이지를 발견했다. 추천이나 기능·가격 보증이 아니라 경쟁 검색 의도 표본이다. 해당 제목/구조를 재작성하지 않았다.
- 경쟁 페이지에도 입력 범위·학습법 안내가 있으므로 모두 불충분하다고 단정하지 않는다. 이번 글은 가상 원문→검증 가능한 질문→생성 불가 질문→현재 제품의 구체적 조작을 연결한다.
- Google 국가별 결과 화면·자동완성·PAA를 직접 수집하지 않았다. 대체 웹 검색과 공식 대학 자료를 사용했다. Trends·Keyword Planner·검색량·예상 트래픽·전환율 자료 없음. 대학 자료는 학습 문제의 근거이며 제품 효과나 시장 규모의 근거가 아니다.

## 구현과 검증·배포 기록

레지스트리, 목록, slug 렌더러, 메타데이터, BlogPosting/Breadcrumb, sitemap에 반영했다. canonical은 영어 한 URL이며 번역 hreflang 없음. 기존 요구사항 글과 영어 quiz 랜딩→새 글, 새 글→기존 두 글·퀴즈 생성·가격·샘플로 연결. 내부 UTM 없음. 기존 growth landing 허용은 레지스트리에서 자동 반영한다.

사전 운영 확인: Vercel `dpl_AZZMnhBpg4vgJaKLh3kGiAK3MTWd`, production READY, main `0d114146e1d092358f41274d1fad2d4f7a0dae39`, rubricheck.com 별칭. 이전 첫 글·두 번째 글이 포함된 운영 커밋이다. 운영 사이트에 회귀 검사하지 않았다.

검증·새 배포 결과는 작업 완료 후 아래에 기록한다. 로컬 검증은 `.growth-local/blog-20261104/rubricheck-verify`에서 자동 로딩 dotenv를 복사하지 않고 수행한다. 빌드 설정 확인용 OpenAI 값은 명백한 fixture 문자열이며 실제 AI 호출 없음. 첫 제한 네트워크 빌드는 기존 Google Fonts 다운로드 실패로 중단, 같은 소스·격리 환경에서 네트워크 허용 후 재시도했다.

### 완료한 로컬 검증

- 변경 파일 ESLint, production build(TypeScript 포함), growth 개인정보·경로 테스트 7건 통과.
- `npm run test:seo`: 공개 URL 116개 통과. 기존 quiz 기능의 7개 언어 경로가 늘어난 점을 반영해 이전 108개 고정값을 갱신했다. 퀴즈 본문의 원문·해설을 서버 HTML에서 확인하고 비공개 quizzes 경로의 noindex·sitemap 제외도 검사한다.
- `npm run test:blog:browser`: 기존 두 글과 신규 글, 390/1280px, canonical, no-JavaScript 읽기, 키보드 해설 열기, 내부 링크, 퀴즈 생성 진입 및 로그인 후 돌아올 경로, 404 통과. 신규 글 axe WCAG A/AA 위반 0, 브라우저 런타임 오류 0.
- 최초 SEO 검사 실패는 모든 가이드에 table이 있어야 한다는 이전 테스트 가정이었다. 새 글은 원문·객관식·접는 해설을 검사하도록 보완했다. 최초 브라우저 검사 실패는 Next client navigation 직후 URL을 동기 확인한 대기 문제였고, 목적지 도달을 기다린 뒤 통과했다. 제품 오류로 숨기거나 성공으로 기록하지 않았다.
- 외부 브라우저 요청 차단, 익명 API fixture 사용. 실제 계정 인증, AI 생성 실행·저장, 퀴즈 응답의 서버 저장, 평가·결제·운영 분석 수집은 제외했다. 글→생성 진입 통과를 AI 생성 완료로 해석하지 않는다.
- 미리보기: [모바일](../verification/blog/quiz-generator-390.png), [데스크톱](../verification/blog/quiz-generator-1280.png). 접근성 검사로 활성화된 skip link가 보일 수 있다.
- 발행 메타데이터 2026-11-04. 배포 완료 여부와 배포 ID는 별도 `2026-11-04-blog-release.json`에 최종 기록한다. 해당 기록이 없으면 배포 완료로 추정하지 않는다.

## 성과 측정과 후속 작업

GSC: 새 URL과 `quiz generator from notes`, `pdf to quiz`, `lecture notes quiz`, `practice questions from notes` 질문군을 함께 관찰한다. Canada/UK/Australia 필터는 실제 교차자료가 생긴 뒤 적용. 기존 `/ai-quiz-generator`와의 의도 분리·유입 이동도 본다.

기존 RubriCheck growth 이벤트는 평가 중심이다. 글 최초 유입→`evaluation_started`→`evaluation_result_viewed`는 부수 평가 이용에만 사용하고 퀴즈 이용으로 해석하지 않는다. 퀴즈 전용 퍼널은 이번에 새로 구현하지 않았다. 향후 동의·개인정보 정책에 맞춰 생성 요청→저장 완료→attempt 시작→답 저장→결과 확인을 검증 가능한 job/attempt 단위로 측정해야 한다. 이벤트 이름이나 수집 여부를 존재하는 것처럼 보고하지 않는다. 링크 클릭·로그인 도달은 퀴즈 생성 완료가 아니다.

배포 후 첫 28일은 색인·초기 관찰, 다음 28일과 비교하며 8~12주까지 충분히 관찰한다. 학기 일정·기기·순위·새 기능 출시 시점을 함께 고려한다. 검색 증가 보장 없음. 필요한 자료는 최신 GSC 국가×쿼리×페이지, 동의 기반 새 landing별 퀴즈 완료 퍼널, 개인정보를 제외한 추출 실패 유형이다. 다음 글 후보는 assignment feedback→quiz이며 실제 사용 근거 확보 후 결정한다.
