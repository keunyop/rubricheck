# 2026-11-10 평가 실패·블로그 후속

- Run: `2026-11-10-grading-content`, America/Vancouver.
- 요청: PO가 누적 grading failures를 직접 챙기고 새 블로그 글의 작성 시점을 확정한다.
- 선택: GRADE-001 운영 실패 분류·입력 파싱 수정, CONTENT-001 영어 글 초안 완료. 이전 성장·퀴즈 작업은 기존 확인일대로 유지한다.
- 상태: `verified_production` (코드 출시 확인). 관리자 보관함 전체 조회는 인증 부재로 미완료이며 0건으로 해석하지 않는다.

## 평가 실패 분류와 조치

- Vercel production의 최근 개별 로그를 first-party 요청 최종 결과와 대조했다. 반복된 `GRADE_REQUEST_FAILED`는 multipart 경계 정보가 없는 업로드를 `request.formData()`가 거부한 것이며, 평가 모델 이전 `validation` 단계다. 그동안 공통 예외 처리로 500이 반환돼 서버 실패 지표를 부풀렸다. 웹 클라이언트는 FormData 전송 시 Content-Type을 직접 설정하지 않아 정상적인 경계 정보 생성을 맡긴다. 특정 환경의 잘못된 요청 형성 원인 자체는 확인되지 않았다.
- `RUBRIC_SCHEMA_VALIDATION_FAILED`의 `total_score` 불일치가 최신 production에서 재시도 뒤에도 관측됐다. 동일 방문 흐름에서 후속 평가 성공이 확인됐다. 원본을 읽지 못했으므로 사용자 기준표의 불일치인지 모델 추출 오류인지 단정하지 않는다. 임의 점수 재조정은 grading 신뢰성을 해쳐 적용하지 않았다. 4xx로 집계되어도 사용자 영향으로 추적한다.
- 관리자 실패 보관함은 7일 진단 이력으로 성공 뒤의 이전 실패가 자동 삭제되지 않는다. 목록 건수는 현재 미해결 요청 수가 아니다. 보관함 항목 전체와 원본은 인증되지 않아 읽지 못했으며, 기록을 지우지 않았다. 해당 접근·판정은 [운영 기준](../operating-model.md)의 일일 분류 절차에 추가했다.
- 업로드 파싱 오류는 이제 `INVALID_FORM_DATA` 400과 재업로드/텍스트 붙여넣기 안내로 응답한다. 일곱 언어 UI에 안내를 연결했고 원본 보관·사용량 예약은 하지 않는다. 내용 없는 warning만 남겨 재발을 확인할 수 있다.

## 새 블로그 글

- [How to Compare Essay Drafts with the Same Rubric](../../seo/drafts/2026-11-10-compare-essay-drafts-with-rubric.md) 영어 초안을 2026-11-10에 완성했다. 가상 V1/V2 사례와 루브릭별 비교, 수정 기록, AI 점수 범위 해석, 버전 관리·재평가 경로를 포함한다. 검색 의도는 기존 글과 구분하되, 정확한 새 키워드 수요는 미측정이다.
- 제품 주장·출처·기존 내부 링크를 대조했고 320/390/1280px 비공개 미리보기를 확인했다. 블로그 registry·route·sitemap은 수정하지 않았으므로 아직 공개되지 않았다. 게시 권한은 [운영 기준](../operating-model.md)에 따라 별도 승인 대상이다.

## 검증·후속

- malformed multipart 회귀, 사용량/보관·기존 평가 경로 및 i18n 합성 테스트 34건 통과. 수정 파일 ESLint와 production build 통과. 실제 운영 원본·유료 AI 호출은 실행하지 않았다.
- [변경 커밋](https://github.com/keunyop/rubricheck/commit/d5626b6b0bdf54a113ebb0d2382bda2c5183fb7d)의 Vercel production `dpl_CsPkbudF3xWdjXHP2hJnwZGWZTRp`가 READY이고 rubricheck.com에 연결됐다. 운영 도메인에 합성 malformed multipart POST를 보내 `400 INVALID_FORM_DATA`와 재시도 안내를 확인했다. 해당 배포에 경고 로그가 남았고 같은 범위의 error/fatal 로그는 없었다. 합성 검증은 정상 사용자의 업로드 성공률을 증명하지 않는다.
- 배포 뒤 실제 `/api/evaluate` 400 응답과 신규 `INVALID_FORM_DATA` warning 추이를 확인한다. 다음 daily에는 최신 보관함 stage/code와 first-party terminal 결과를 다시 대조하고, 루브릭 구조화 실패가 반복되면 인증된 최소 원본으로 재현한다. 관리자 요약을 받기 전까지 보관함 해결 완료로 표시하지 않는다.
- 기존 업로드의 성공률 개선은 신규 요청을 관찰하기 전에는 주장하지 않는다. 수정으로 정상 FormData가 거부되거나 요금 예약/환불 회귀가 보이면 해당 최소 변경을 revert한다.
