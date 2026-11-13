# RubriCheck 제품 디자인

## 방향과 적용 범위

RubriCheck는 학생과 교육자가 제출 전 초안을 평가 기준에 맞춰 검토하는 도구다. 화면의 성격은 차분함·정확함·친절함이며 문서와 검토 주석을 시각적 소재로 삼는다. 기존 로고와 Geist 글꼴을 유지하고, 실제 평가 기준과 수정 의견이 화면의 중심이 되게 한다. 이 방향은 2026-11-13 사용자가 승인한 디자인 개선에서 정했다. 새로운 제품 방향이나 사용자의 구체적인 디자인 요청을 막는 고정 규칙으로 해석하지 않는다.

## 판단을 바꾸는 기준

- 공통 색상은 [globals.css](../../../../app/globals.css)의 `--rc-*` 토큰을 우선 사용한다. 흰색·중립색 표면, 본문·보조·메타의 세 가지 텍스트 역할을 유지한다. 인디고는 과제 평가, 청록은 퀴즈의 선택·주요 행동·피드백에 사용한다. 모드가 바뀔 때 전체 배경을 색으로 채우지 않는다.
- 평가 범위 옆 상승 화살표는 비교 자료 없이 개선을 암시하므로 붙이지 않는다. 실제 점수 범위와 분모를 유지하고 숫자에는 `tabular-nums`를 쓴다. 샘플과 AI 추정치라는 설명은 작은 장식 문구로 숨기지 않는다.
- 선택한 평가 기준과 설명은 같은 색의 시작 방향 세로선으로 연결한다. 예: 선택한 Evidence 행과 그 피드백에 같은 인디고 주석선을 사용한다. 점수·모든 행·제목을 동시에 강조하지 않는다. 색 외에도 `aria-pressed`, 테두리, 텍스트를 사용한다.
- 화면마다 새 글자·여백 값을 만들기보다 4px 간격 체계와 기존 역할을 따른다. 설명·법적 고지·파일 형식은 일반적으로 12px 이상, 긴 읽기 본문은 14–16px로 유지한다. 작은 글자에는 음수 자간이나 대문자 변환을 적용하지 않는다. 모바일 주요 조작은 최소 44px 터치 영역을 확보한다.
- 긴 작업 화면의 표면은 중립색으로 유지한다. 실제 샘플 피드백과 퀴즈를 제품 시각 자료로 활용하고, 의미 없는 AI 이미지·배경 그라데이션·상시 애니메이션을 추가하지 않는다.

## 구현 지도와 유지해야 할 UX

- 공개 랜딩: [ProductOverview](../../../../app/components/ProductOverview.tsx)와 [product.module.css](../../../../app/components/product.module.css). 샘플 기준 선택은 평가 API나 크레딧을 사용하지 않는다. 샘플 데이터는 기존 `SAMPLE_EVALUATION`을 사용한다.
- 공개 탐색: [SiteChrome](../../../../app/components/SiteChrome.tsx). 모바일 메뉴는 일반 탐색 링크를 여닫는 disclosure다. `aria-expanded`와 `aria-controls`, Enter/Space 열기, Escape 닫기와 버튼 포커스 복귀를 유지한다. 닫힌 링크는 탭 순서에서도 빠져야 한다. 로그인은 모바일 메뉴 안에서도 찾을 수 있어야 하며, 큰 화면으로 전환하면 탐색 링크가 보여야 한다.
- 과제 입력: [home.module.css](../../../../app/home.module.css), 과제·퀴즈 공통 사이드바: [assignmentWorkspace.module.css](../../../../app/components/assignmentWorkspace.module.css), 퀴즈: [quiz.module.css](../../../../app/quizzes/quiz.module.css). 스타일 작업으로 파일/텍스트 전환, 초안 복구, 비회원 체험, 평가 옵션의 접근 권한을 바꾸지 않는다.
- 공개 홈과 `/workspace`의 역할은 다르다. 로그인/저장 결과/결제 복귀 경로, locale 쿼리와 앵커를 유지한다. 새 문구는 기존 번역 구조에 넣고, `text-align: start`·`border-inline-start` 등 논리적 방향 속성을 우선 사용한다.
- 작업 입력이 계속 비활성화되면 `hasLoadedAccountSummary` → `draftReady`/`resultReady` 초기화 흐름을 확인한다. 계정 요약 effect에서 타이머 실행 전 ref를 완료로 표시하면 Strict Mode의 setup/cleanup 재실행에서 타이머가 취소되고 재등록되지 않는다. 각 effect setup이 자신의 타이머를 소유하게 하고, 브라우저 검증은 fieldset 활성화까지 기다린다.
- 가격 화면의 시각적 정리는 요금·할인·무료 한도·결제 가능 상태 변경을 포함하지 않는다. 모드별 색과 오류·정답 같은 의미 색도 구분한다.

## 확인 방법

변경 규모에 맞는 검증을 선택한다. 브라우저 검증은 로컬 서버에서 합성 API 응답으로 실행하고 실제 평가·이메일·결제를 호출하지 않는다.

- `node scripts/check_design.mjs`: 320/390/768/1024/1440px 공개 화면과 작업 화면 overflow, EN/KO/MS/UR 모바일 메뉴의 키보드·경로 전환·데스크톱 복귀를 확인한다. 캡처는 Git에서 제외된 `.growth-local/design/`에 저장한다.
- 공통 탐색·랜딩 변경은 `test:entry:browser`, 입력/모달/가격 변경은 `test:ui:browser`, 퀴즈 변경은 `test:quiz:browser` 등 관련 기존 테스트를 고른다. 각 스크립트의 로컬 서버 포트와 테스트 secret 요구를 먼저 확인한다.
- 스타일 숫자만 검사하지 말고 데스크톱·모바일 실제 캡처에서 읽기 순서, 제목 줄바꿈, 콘텐츠 밀도, 버튼 가림 여부를 확인한다. 실행하지 못한 검증은 통과로 기록하지 않는다.

## 출처

[unslop](https://github.com/heydamir/unslop), Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0의 진단·절제·제품 중심 시각화 원칙을 RubriCheck에 맞게 적용했다. 이 문서는 제품별 적용 지침이며 외부 스킬 전문의 대체본이 아니다. 원문은 프로젝트의 [unslop 스킬](../../unslop/SKILL.md)에 있다. 이미 승인한 이번 방향을 구현하는 중에는 방향 확인을 반복하지 않는다.
