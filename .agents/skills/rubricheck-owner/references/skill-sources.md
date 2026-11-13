# 외부 스킬 조사와 채택 근거

조사일: 2026-11-11. 스킬 유지보수 때 읽는다. 아래 공개 원문을 참고해 Rubricheck에 필요한 판단 절차를 한국어로 새로 작성했다. 외부 패키지·실행 스크립트·hook을 설치하거나 원문 전체를 포함하지 않았다.

## 후보와 인기 근거

GitHub 공개 페이지에서 열람한 반올림 표시값이다. 별 수는 관심도의 대리지표이며 설치 수·활성 사용자 수·품질을 뜻하지 않는다. 실제 사용량은 확인하지 못했다. 인기만으로 채택하지 않고 기존 스킬의 공백, 제품 적합성, 실행 환경, 유지 비용을 함께 판단했다.

| 모음 / 원본 | GitHub 별 표시값 | 확인한 강점과 Rubricheck 채택 판단 |
| --- | --- | --- |
| [GStack — garrytan/gstack](https://github.com/garrytan/gstack) | 약 141.2k | 제품 관점에서 전제를 재검토하고 대안을 비교하는 절차 채택. 기존 출시·QA 지침과 겹치는 전체 프레임워크는 추가하지 않음 |
| [PStack — cursor/plugins/pstack](https://github.com/cursor/plugins/tree/main/pstack) | 상위 cursor/plugins 전체 약 16.0k; PStack 단독 수치 아님 | Lauren Tan(poteto)의 원본. 변경이 다른 경계에 미치는 영향과 실제 실행 증거 검토를 채택 |
| [Superpowers — obra/superpowers](https://github.com/obra/superpowers) | 약 316.2k | 완료 주장을 실행한 검증에 연결하는 원칙 채택. 모든 작업에 설계 승인·TDD를 강제하는 흐름은 도입하지 않음 |
| [PM Skills — phuryn/pm-skills](https://github.com/phuryn/pm-skills) | 약 27.9k | 고객 문제·위험 가정·작은 요구사항·결과 중심 우선순위를 보강. 이력서·법률 문서 등 운영과 무관한 모듈 제외 |
| [Marketing Skills — coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 약 59.7k | 첫 가치 도달·cohort·실험 판정을 보강. 광고·외부 발송·가격 변경 자동화는 도입하지 않음 |

[backnotprop/pstack](https://github.com/backnotprop/pstack)의 README도 확인했다. 이 저장소는 Cursor 원본의 별도 미러/이식판이라고 명시하므로 원본과 구분했다. 이름만 보고 별개의 제품 관리 프레임워크라고 분류하지 않았다.

## 읽은 원문과 연결된 절차

각 모음의 README와 아래 스킬 본문을 확인했다. 링크는 유지보수 편의를 위한 main 경로이며 이후 바뀔 수 있다. 아래 SHA는 열람 당시 **파일 blob SHA**로, 릴리스 버전이나 커밋 SHA가 아니다.

| 원문 | 반영 위치 / 선택한 개념 | 열람한 파일 blob SHA |
| --- | --- | --- |
| [GStack plan-ceo-review](https://github.com/garrytan/gstack/blob/main/plan-ceo-review/SKILL.md) | [제품 판단](product-decisions.md): 전제·기존 해결책·최소 범위 비교 | `e64c876ece927762722794bf4fad0d8c55b1a292` |
| [PStack blast-radius](https://github.com/cursor/plugins/blob/main/pstack/skills/blast-radius/SKILL.md) | [변경 검토](delivery-review.md): diff 밖 소비자·안전 조건의 증명 | `b296cce0d746260a53c16e3671cb05bacfe82daf` |
| [PStack interrogate](https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md) | [변경 검토](delivery-review.md): 주장과 확인된 결함을 구분하는 검토 | `169f5b478f4cb53a4c5ab6046576034b4b07cfe8` |
| [Superpowers verification-before-completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md) | [완료 판정](delivery-review.md): 변경 이후 검증 증거와 환경 기록 | `7d45333cc4a49c57a80df6c1fe2fa777a207afbc` |
| [PM Skills identify-assumptions-existing](https://github.com/phuryn/pm-skills/blob/main/pm-product-discovery/skills/identify-assumptions-existing/SKILL.md) | [제품 판단](product-decisions.md): 유용성·사용성·사업성·구현 가능성 가정 | `66da6c92e1a0722791882f325734d1de3d98e5b2` |
| [PM Skills create-prd](https://github.com/phuryn/pm-skills/blob/main/pm-execution/skills/create-prd/SKILL.md) | [최소 요구사항](product-decisions.md): 사용자·문제·결과·범위·수용 기준 | 파일 본문과 README 확인 |
| [Marketing Skills onboarding](https://github.com/coreyhaines31/marketingskills/blob/main/skills/onboarding/SKILL.md) | [첫 성공과 재사용](product-decisions.md): 첫 가치 도달, 성숙 cohort, 상관관계의 한계 | 파일 본문과 README 확인 |
| [Marketing Skills ab-testing](https://github.com/coreyhaines31/marketingskills/blob/main/skills/ab-testing/SKILL.md) | [작은 실험과 판정](product-decisions.md): 사전 가설·표본·보호 지표·종료 규칙 | 파일 본문과 README 확인 |

## Rubricheck에 맞춘 조정

- 기존 daily/weekly/monthly 운영을 유지하고 `discover`·`experiment`·`review`를 추가했다. weekly 우선순위나 전환 개선에서도 필요한 절차만 읽는다.
- 요구사항과 실험은 기존 backlog·실행 기록·experiments에 연결한다. 외부 모음의 자체 TODO·PRD·메모리 저장소를 추가하지 않는다.
- 원본에 있는 대규모 병렬 실행, 특정 모델·브라우저 강제, telemetry, 자동 업데이트, 설치 스크립트는 채택하지 않았다. 현재 사용 가능한 도구와 기존 위임 범위를 따른다.
- 인터뷰·시장 반응·개선율을 생성해 근거로 쓰지 않는다. 저표본 환경에서는 관찰과 인과를 구분하며, 합성 테스트는 사용자 수요 증거로 취급하지 않는다.
- PStack의 실행으로 입증된 결함 중심 검토를 적용하되 아직 재현하지 못한 보안·데이터 손실 우려도 미검증으로 남긴다.
- 모든 단계의 재승인, 사소한 수정의 PRD/TDD, 외부 스킬의 광범위한 범위 확대는 도입하지 않았다. 기존 권한 원장과 사용자의 요청 범위가 우선한다.

## 유지보수 시 확인

외부 이름·파일 경로가 바뀌거나 이 절차가 실제 업무에서 부족한 경우 관련 원문만 다시 확인한다. 설치 안내·브랜드 인지도보다 실제 판단 품질을 기준으로 수정한다. 이 조사 자체는 앱 변경·운영 지표 조회·production 배포를 요구하지 않는다.
