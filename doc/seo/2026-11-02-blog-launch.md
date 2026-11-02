# First blog article: assignment requirements checklist

Implemented locally; not deployed. Source: `doc/report/google_search_console_report_20261102`, Web Search, August 1–October 31, 2026. Original exports are unchanged.

## Audience and search intent

First growth experiment: US, English. US performance is 5,364 impressions, 561 clicks, 10.46% CTR and average position 6.38. Malaysia contributes more clicks (1,040), with 2,176 impressions, 47.79% CTR and position 1.78. The US has a larger impression base with room to improve. This does not establish which country converts best; no conversion data was supplied.

Global query opportunities:

| Query | Impressions | Clicks | Average position |
| --- | ---: | ---: | ---: |
| assignment requirements checker | 44 | 0 | 5.48 |
| assignment instructions checker | 46 | 0 | 11.39 |
| assignment criteria checker | 54 | 0 | 8.44 |
| check assignment against rubric | 67 | 2 | 7.43 |

These are small samples. The country and query exports are separate aggregates; do not interpret these as US-only query measurements or total market search volumes.

## Implementation

- `/blog` and `/blog/assignment-requirements-checklist` render full English content on the server.
- The article answers how to check requirements, distinguishes instructions from grading criteria and submission details, and includes an original worked checklist.
- Existing assignment, essay, rubric-use and feedback guides link to the article. Header/footer and English homepage link to the blog.
- The main CTA enters the existing workspace with general criteria selected; the copy explains how to use an instructor rubric instead.
- Canonical, social metadata, BlogPosting, breadcrumbs and the sitemap describe only actual English pages. Other language links lead to existing localized homepages.
- The two public blog URLs join the existing analytics allowlist. Internal links do not use UTM tags or overwrite acquisition attribution.

Tool-seeking queries remain associated with `/assignment-rubric-checker`; the new article serves the checklist/how-to intent. Avoid creating another article for every wording variation. Obtain query-by-page data before changing additional landing pages.

## Verification

Validation used a separate local checkout with dependencies installed from the lockfile, no production dotenv files, and a deliberately invalid fixture OpenAI value only to satisfy the existing build-time configuration check. No AI evaluation, authentication, billing, email or hosted regression was performed.

- Next production build including TypeScript: passed.
- ESLint for changed source and the new browser check: passed.
- Growth attribution and privacy tests: 7 passed.
- `npm run test:seo`: 107 public URLs passed; all requests stayed on loopback.
- `npm run test:blog:browser`: mobile/desktop rendering, client navigation metadata, no-JavaScript reading, existing-guide links, workspace entry, valid language destinations, 404s and runtime errors passed. Service APIs were anonymous fixtures.

The browser script requires an existing Playwright installation, like the repository's other browser scripts. Set `PLAYWRIGHT_MODULE` to its `index.mjs` if needed; Windows defaults to Edge. Run it after a clean local build in a checkout without automatically loaded dotenv files. Preserve the original ignored production credentials in their existing location.

## Measure after release

Use Search Console to compare the same query groups, country and device over 28-day windows. Use existing product analytics/GA4 to measure article entry → workspace → evaluation started/result. CTR alone does not establish conversion or demand. Read-only GA4 access and a US-filtered query/page export would improve the next decision; the current CSV was sufficient for this first article.

References: [Google CTR diagnosis](https://support.google.com/webmasters/answer/10268906?hl=en), [Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [UNC assignment guidance](https://writingcenter.unc.edu/tips-and-tools/understanding-assignments/), [Carnegie Mellon rubric guidance](https://www.cmu.edu/teaching/assessment/assesslearning/rubrics.html).
