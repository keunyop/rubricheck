# Rubricheck 운영 보고서 업로드

Owner는 이 폴더에서 `latest_complete_date`가 가장 최신인 유효 보고서를 찾아 사용한다. 폴더명이나 업로드 시각보다 보고서의 실제 기간을 우선한다. API 연결은 필요하지 않다. 저장소가 공개되어 있으므로 집계된 보고서만 올리고 이메일, 이름, 사용자·client ID, 결제·주문 ID, 과제 원문, 행 단위 이벤트는 포함하지 않는다. GSC 검색어에 개인 식별 정보가 섞였으면 해당 행을 삭제하거나 마스킹한다.

## 권장 주기

| 시점 | 업로드 내용 | 기간 |
| --- | --- | --- |
| 매주 월요일 | GSC 전체 export, GA4 landing page, traffic acquisition, events/key events | 최신 완료일로 끝나는 56일 |
| 매월 첫 월요일 | 위 주간 자료 + GA4 retention/cohort, 필요하면 집계 monetization | 최근 90일 또는 최근 3개 완결 월 |
| 큰 SEO·랜딩 변경 후 | 정기 업로드 외에 변경 후 7일과 28일 시점 | 같은 56일 창을 유지 |

매일 올릴 필요는 없다. GA4 일일 데이터는 처리 중 변경될 수 있고 GSC 최신 날짜도 잠정치일 수 있으므로, 월요일 업로드는 가능하면 직전 금요일까지의 완결 데이터를 사용한다.

## 필요한 보고서

### 1. GSC Search results export — 필수

Search Console의 **실적 > 검색 결과**에서 검색 유형을 Web으로 두고 최근 완결 56일을 선택한다. 총 클릭수, 총 노출수, 평균 CTR, 평균 게재순위를 켠 뒤 CSV로 내보내고 생성된 폴더를 그대로 올린다. 기본 export의 queries, pages, dates/chart, countries, devices, search appearance, filters 파일이면 충분하다. 파일명이 한국어여도 된다.

### 2. GA4 Landing page — 필수

다음 열을 포함한 CSV를 올린다: landing page, sessions, active users, new users, engaged sessions, average engagement time per session, key events, session key event rate. URL query string은 제외한다.

### 3. GA4 Traffic acquisition — 필수

다음 열을 포함한다: session default channel group, session source/medium, sessions, active users, engaged sessions, engagement rate, key events. 캠페인별 분석이 필요하면 campaign은 추가해도 된다.

### 4. GA4 Events 또는 Key events — 필수

다음 열을 포함한다: event name, event count, total users, key events. 이메일, user ID, event parameter 원문은 제외한다.

### 5. GA4 Retention/cohort — 월간 권장

최근 90일 또는 최근 3개 완결 월의 신규 사용자, 재방문 사용자, cohort별 D7/D28 유지 자료를 올린다. 표본이 작거나 threshold가 적용되면 그 사실을 manifest에 기록한다.

## 폴더 예시

```text
doc/report/
  2026-11-16/
    REPORT.md
    gsc/
      (Search Console에서 받은 CSV 폴더 내용)
    ga4/
      landing-pages.csv
      traffic-acquisition.csv
      events.csv
      retention.csv        # 월간만
```

기존 `google_search_console_report_YYYYMMDD` 형태도 지원한다. 같은 날짜의 GA4 파일은 별도 `google_analytics_report_YYYYMMDD` 폴더로 올려도 된다.

## REPORT.md에 적을 내용

```markdown
- exported_at: 2026-11-16T09:00:00-08:00
- period_start: 2026-09-19
- period_end: 2026-11-13
- latest_complete_date: 2026-11-13
- timezone: America/Vancouver 또는 GA4 property timezone
- property: rubricheck.com / GA4 숫자 property ID
- filters: GSC Web, site-wide, 기타 적용 필터
- caveats: threshold, (other), 행 제한, 누락된 보고서
```

Owner는 기간·timezone·필터가 같은 자료만 비교한다. queries/pages/countries/devices와 landing/source/event breakdown의 합계를 서로 더하지 않는다. manifest가 없으면 CSV의 날짜로 임시 판단하지만 `metadata_missing` 한계를 남긴다.
