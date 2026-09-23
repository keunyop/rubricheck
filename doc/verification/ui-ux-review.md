# RubriCheck UI/UX 점검 및 개선

2026-09-22 · 로컬 코드와 Chromium 화면 기준

홈, 과제 입력, 샘플과 평가 결과, 프로젝트 탐색, 로그인, 가격·충전, 루브릭 보관함, 실제 성적 기록, 피드백 흐름을 점검했습니다. 반복 설명과 장식이 많은 홈 화면을 입력 중심으로 정리하고, 실제 사용을 막는 키보드·로그인 진입 문제를 수정했습니다.

| 발견한 문제 | 적용한 개선 |
| --- | --- |
| 긴 제품 소개, 반복 배지·설명, 크게 늘어나는 빈 카드 | 가이드 링크와 접을 수 있는 FAQ로 정리. 기존 가이드 URL과 FAQ 답변 유지 |
| 헤더와 입력 폼의 시각적 우선순위가 불분명 | 브랜드·제목·입력 단계·실행 버튼 순서 정리, 중립 배경과 일관된 간격 |
| 작은 입력 방식 버튼과 좁은 모바일 배치 | 단계 표시, 선택 상태, 반응형 카드, 터치 영역과 입력 글자 크기 개선 |
| 파일 선택이 숨겨진 input의 label로만 제공됨 | 실제 버튼으로 교체하여 Tab·Enter로 파일/카메라 선택 가능 |
| 입력창이 placeholder에 의존 | 루브릭·과제 제목을 접근성 이름으로 연결 |
| 로그인 창의 초기 포커스·순환·복원과 닫기 동작 부족 | 네이티브 dialog, 보이는 닫기 버튼, Esc, Tab 순환, 이전 포커스 복원, Enter 제출, 코드 자동완성 |
| 계정 메뉴가 헤더 경계에 잘릴 수 있음 | 헤더의 overflow clipping 제거 |
| 비로그인 상태의 충전 버튼이 비활성화됨 | 기존 로그인 처리로 정상 연결. 로그인 전 결제 요청 없음 |
| 가격 화면의 반복 경고와 과한 배경·그림자 | 요금·혜택·선택·구매 동작 중심으로 정리, 선택 상태를 보조기기에 전달 |
| 포커스와 오류·진행 상태 안내가 불일치 | 공통 포커스 표시, 본문 건너뛰기, 오류/진행 상태 접근성 보완 |

채점·과금·권한·저장 API 구현과 데이터 모델은 변경하지 않았습니다. 사용자 작업 중이던 `doc/growth` 변경도 보존했습니다.

## 검증

| 항목 | 결과 |
| --- | --- |
| `npm run build` | 통과, TypeScript 검사 포함 |
| `npm run test:all` | 144개 통과, 실패 0 |
| 변경/추가한 TSX·TS·MJS 파일 ESLint | 통과 |
| `npm run test:ui:browser` | 통과: 320/390/768/1024/1440px, 키보드 업로드, FAQ, 로그인, Strict Mode, 사용량 제한, 충전 실패 후 재시도 |
| 기존 브라우저 검사 | 최종 배포 빌드에서 6종 모두 통과: 게스트 체험, 프로젝트, 평가 복구, 실제 성적, 루브릭, 피드백 |
| `npm run test:seo` | 공개 페이지 13개 통과: 내부 링크, 메타데이터, 구조화 데이터, 사이트맵 등 |
| 브라우저 런타임 오류 | 새 UI 검사에서 0개 |

전체 `npm run lint`는 기존 `doc/growth/browser-audit.cjs`, `doc/growth/public-flow-audit.cjs`의 CommonJS import 오류 6개와 기존 경고 5개 때문에 실패합니다. 이번 변경 코드에는 린트 오류가 없습니다.

브라우저 검사는 로컬 서버와 모의 API를 사용했습니다. 실제 AI 평가, 이메일 전송, Stripe 결제, 운영 DB 쓰기는 실행하지 않았습니다. Chromium에서 확인했으며 실제 iOS/Safari 기기 검증은 포함하지 않습니다.

개발 서버에 남아 있던 이전 CSS 캐시는 서버를 재시작하고 배포 빌드로 다시 확인했습니다. 피드백 관리 화면 검사는 로컬 서버 프로세스에만 `ADMIN_SECRET=local-feedback-browser-test`를 설정해 기존 테스트 쿠키와 맞췄습니다. 운영 설정 파일은 변경하지 않았습니다.

## 화면 기록

| 화면 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 홈 데스크톱 | [이전](ui/before-home-desktop.png) | [개선](ui/home-1440.png) |
| 홈 모바일 | [이전](ui/before-home-mobile.png) | [개선](ui/home-390.png) |
| 가격 | [이전](ui/before-pricing-desktop.png) | [개선](ui/pricing-desktop.png) |

[모바일 로그인](ui/login-mobile.png) · [모바일 충전](ui/topups-mobile.png) · [UI 검사 결과](ui/results.json)

## 재실행

로컬 서버 실행 후 `npm run test:ui:browser`를 사용합니다. 기본 주소는 `http://127.0.0.1:3000`이며 `TEST_BASE_URL`로 바꿀 수 있습니다. Playwright가 외부에 설치되어 있으면 `PLAYWRIGHT_MODULE`에 해당 패키지의 `index.mjs` 경로를 지정합니다. Windows에서는 기존 Playwright 설치를 자동으로 찾습니다.

기존 브라우저 명령은 기본 포트가 3100이므로 포트 3000 서버를 사용할 때 `TEST_BASE_URL`을 지정해야 합니다. `check_feedback_navigation.mjs`의 관리 화면 검사는 로컬 서버의 `ADMIN_SECRET`과 테스트의 `TEST_ADMIN_SECRET` 값이 일치해야 합니다.
