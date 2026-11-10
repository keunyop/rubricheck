# GSC와 GA4 읽기 연결

## 현재 권장 방식: doc/report 업로드

API 연결은 필수가 아니다. 사용자가 [보고서 업로드 안내](../report/README.md)에 따라 `doc/report/`에 최신 GSC·GA4 집계 파일을 올리면 owner가 다음 실행에서 가장 최근 유효 폴더를 찾아 분석한다. 매주 최근 완결 56일을 올리는 방식이 기본이며, API·OAuth·MCP 설정은 자동 수집이 다시 필요할 때만 선택한다.

이 저장소는 공개이므로 이메일, 사용자 ID, client ID, 결제·주문 ID, 원문, 행 단위 이벤트를 업로드하지 않는다. 검색어에 이메일·이름·식별자가 섞였으면 삭제하거나 마스킹한다.

## API 연결은 선택 사항

목표는 owner가 최신 검색·방문 데이터를 최소 읽기 권한으로 직접 확인하는 것이다. 비밀번호, OAuth token, ADC 파일, service-account JSON은 저장소나 채팅에 넣지 않는다. 저장소 밖의 사용자 전용 절대경로에 보관하고 해당 파일명이 `.gitignore`에 포함되는지 확인한다.

## 가장 간단한 연결

하나의 연결 도구로 시작하려면 GSC와 GA4를 모두 지원하는 read-only connector를 Codex에 설치하고 Rubricheck 속성만 선택한다. 현재 플러그인 목록에서는 Windsor.ai가 두 서비스를 모두 지원하며 OpenSEO는 GSC, Supermetrics는 GA4를 지원한다. 설치 전 공급자의 요금, 데이터 보존, 요청 권한을 확인한다. 광고·자산 write 권한은 분석에 필요하지 않다.

설치 직후 Codex에서 실제 property 목록과 최신 완료 날짜를 읽어 연결 성공을 확인한다. 설치됨 표시만으로 접근 가능하다고 보지 않는다.

## GA4 권장 연결: Google 공식 읽기 전용 MCP

Google 공식 Analytics MCP server는 읽기 전용이며 Admin API와 Data API 보고서를 제공한다.

1. Google Cloud project를 선택하고 Analytics Admin API와 Analytics Data API를 활성화한다.
2. 사용할 Google 사용자 또는 service account 이메일을 GA4 **관리 > 속성 액세스 관리**에서 Rubricheck property의 **Viewer**로 추가한다.
3. 사용자 ADC를 쓴다면 다음 명령으로 로그인하고 quota project를 지정한다.

   ```powershell
   gcloud auth application-default login --scopes="https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform"
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```

4. ADC 파일의 저장소 밖 절대경로와 Cloud project ID로 Codex STDIO MCP를 추가한다.

   ```powershell
   codex mcp add google-analytics `
     --env GOOGLE_APPLICATION_CREDENTIALS="C:\absolute\path\application_default_credentials.json" `
     --env GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID" `
     -- uvx --from analytics-mcp google-analytics-mcp
   ```

5. `codex mcp list` 또는 IDE의 **MCP servers**에서 연결을 확인하고 Codex IDE extension을 다시 연다. accessible account/property, property timezone, 최신 완료 날짜, key events, landing-page 보고서를 읽어 본다.

Service account를 쓰면 그 이메일도 GA4 property Viewer로 추가한다. 가능하면 장기 key 파일보다 service-account impersonation을 우선한다.

공식 자료: [Google Analytics MCP](https://developers.google.com/analytics/devguides/MCP), [GA4 Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart), [Codex MCP 설정](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## GSC 읽기 연결

Search Console API는 private property 데이터에 OAuth 2.0이 필요하다. 읽기에는 `https://www.googleapis.com/auth/webmasters.readonly` scope만 사용한다.

1. Rubricheck Search Console property에 접근할 주체를 정한다.
   - 자동 운영에는 service account 이메일을 property의 제한된 읽기 사용자로 추가하는 방식이 단순하다.
   - 사용자 OAuth를 쓰면 consent screen과 publishing 상태가 장기 refresh token 사용에 적합한지 확인한다. External/Testing 앱은 장기 자동 운영에 맞지 않을 수 있다.
2. Google Cloud project에서 Search Console API를 활성화하고 선택한 자격증명을 만든다.
3. `webmasters.readonly`만 요청한다. 먼저 `GET https://www.googleapis.com/webmasters/v3/sites`로 정확한 property URL과 permission level을 확인한다.
4. Search Analytics query로 date/query/page/country/device별 clicks, impressions, CTR, position을 읽는다. 반환 행 제한과 생략 가능성을 run 기록에 남긴다.

자격증명만 만들면 owner가 GSC를 호출할 수 있는 것은 아니다. Codex에 노출하려면 GSC를 지원하는 read-only connector를 설치하거나, 검토된 로컬 MCP/API wrapper를 등록해야 한다. 현재 확인된 Google 공식 GSC MCP는 없으므로 가장 빠른 방법은 위 connector이고, 자체 wrapper를 만들 때도 `webmasters.readonly`만 허용한다.

공식 자료: [Search Console OAuth](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing), [property 목록](https://developers.google.com/webmaster-tools/v1/sites/list), [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

## 연결 후 owner 확인 항목

- 실제 Rubricheck GSC property URL, permission level, 최신 완료 날짜
- GA4 숫자 property ID, timezone, Viewer/data restriction, key events, GSC link 상태
- 최근/이전 기간 28일 보고서와 API threshold, row-limit, sampling 여부
- 사용자 이메일·문의·검색어와 개별 결제를 직접 결합하지 않는 집계 경계

확인 결과와 다음 수집 날짜를 `doc/operations/state.json`과 해당 run 기록에 남긴다.
