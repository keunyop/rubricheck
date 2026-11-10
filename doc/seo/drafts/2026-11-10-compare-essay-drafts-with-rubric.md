---
status: publication_draft
language: en
title: "How to Compare Essay Drafts with the Same Rubric"
slug: compare-essay-drafts-with-rubric
intended_path: /blog/compare-essay-drafts-with-rubric
meta_description: "Compare two essay drafts with the same rubric. Use a worked revision log to check stronger evidence, interpret AI score ranges and choose your next edit."
category: Assignment revision
author: RubriCheck
drafted_on: 2026-11-10
source_checked_on: 2026-11-10
publication_authorized: false
published_on: null
index_review_on: null
outcome_review_on: null
---

## 편집·게시 검토 메모 — 본문에 포함하지 않음

- 대상 독자: 미국 영어권 대학생을 우선으로, 호주·캐나다·말레이시아의 영어 과제 작성자도 사용할 수 있는 기존 초안 재검토 가이드. 국가별 검색량·전환 우위가 입증된 주제라는 뜻은 아니다.
- 해결할 질문과 의도: “수정 후 점검 점수가 달라졌는데, 실제로 글이 좋아졌는지 어떻게 확인하나?” 이미 초안과 피드백이 있는 독자의 비교·재사용 의도다. 점검 도구를 처음 찾는 검색은 기존 `/essay-rubric-checker`와 `/rubric-checker`가 담당한다.
- 근거: 2026-11-10 확인한 업로드 GSC 검색어×페이지 자료에서 폭넓은 루브릭 점검·채점 의도를 확인했다. 정확한 표 기간과 국가×검색어 자료는 없어 이 세부 제목의 수요·시장 규모는 미측정이다. 원본·비공개 집계는 게시하지 않는다. 세부 주제 선택은 제품의 기존 비교 안내·프로젝트 버전 기능에 연결하는 편집 가설이다.
- 기존 글과 차이: 요건 체크리스트는 제출 요건 존재, critical analysis는 문단 추론, reflective writing은 경험 해석, lab discussion은 실험 결과 해석, quiz generator는 학습 문제 작성을 다룬다. 이 글은 같은 기준의 두 초안 비교와 점수 변동 해석, 재평가 전 확인을 다룬다. 단순 동의어 글을 추가하지 않는다.
- CTA: 본문 말미 `Review my revised draft` → `/workspace#rubric-checker`. 일반 기준을 강제로 선택하지 않고 이전과 같은 루브릭·모드를 독자가 확인한다. 내부 UTM·추가 이벤트·가격·무료 한도 변경 없음.
- 제품·개인정보 확인: `src/lib/scorePresentation.ts`의 범위·동일 모드 비교 안내, `app/components/AssignmentProjectView.tsx`의 버전 목록·New version, `app/HomePageClient.tsx`의 프로젝트 저장·재평가 흐름을 2026-11-10 확인했다. 자동 문장 차이 비교, 공식 성적 예측, 자료 진위 검증, 무제한 무료 재평가를 제공한다고 쓰지 않는다. 예제는 전부 창작이며 학생 자료·개인 식별자 없음.
- 외부 출처 확인일: 2026-11-10. Carnegie Mellon의 rubric 기준 설명과 MTSU의 수정 전략을 실제 열람했다. 출처의 페이지 게시일은 미표기이므로 확인일과 구분한다. 인용문·후기·효과 수치를 만들지 않았다.
- 게시 형식: 기존 영어 블로그 구조를 재사용할 수 있는 H1·H2·짧은 문단·목록·예문 구성. 넓은 표·이미지·외부 embed가 필요 없다. intended URL은 아직 존재하는 공개 링크가 아니다. 라이브 registry·route·sitemap·구조화 데이터는 수정하지 않았다.
- 로컬 검증일·결과: 2026-11-10. 본문 약 1,395단어, title 48자·meta description 153자, H1 한 개, slug 중복 없음, 내부 링크 다섯 개의 목적지 registry/route 확인, 내부 UTM 없음, 발행일·성과 검토일 null 확인. 기존 blog CSS를 적용한 비공개 정적 미리보기에서 320·390·1280px 가로 넘침 없음·CTA 목적지·예문 노출·runtime 오류 없음 확인. 이는 실제 Next 게시 경로나 색인·운영 클릭 검증을 대신하지 않는다.
- 게시 전 최종 확인: 담당자 이외 편집 검토, 실제 블로그 route 변환 후 모바일·키보드·CTA·canonical·BlogPosting·날짜·sitemap·영어 전용 hreflang 정책을 확인한다. 실제 게시일은 승인된 게시 시점에 기록한다. 작성일을 발행일로 미리 사용하지 않는다.
- 검토일: 게시 T+7일 색인·링크·유입 수집, T+28일 같은 기간의 검색과 첫 성공·두 번째 성공·검증된 결제를 검토한다. 현재 미게시이므로 두 날짜는 null이다. 검색 클릭·workspace 진입만으로 구독 전환을 판정하지 않는다.

---

# How to Compare Essay Drafts with the Same Rubric

To compare two essay drafts, keep the assignment instructions and rubric the same, then check what changed under each criterion. Record the passage you revised, the evidence it now provides, and anything still missing. If you use an AI checker, keep the grading mode the same too. A changed score is a reason to inspect the work, not proof that the revision improved it.

This guide is for a draft you have already reviewed once. You can use the process manually or alongside AI feedback. Your instructor's rubric and course rules remain the reference for your final submission.

## 1. Save the first draft and its review conditions

Before making another edit, keep a copy of the earlier draft and the feedback you are responding to. Give each file a clear version name. Write down:

- The assignment question and any relevant instructions.
- The complete rubric, including points and performance descriptions.
- The part of the essay you plan to revise.
- The grading mode, if you used an AI review tool.

Changing the rubric, switching between general criteria and your instructor's criteria, or changing the review mode creates a different comparison. It may still be useful, but you cannot attribute the whole score difference to your writing.

[Carnegie Mellon's guide to rubrics](https://www.cmu.edu/teaching/designteach/teach/rubrics.html) explains how rubrics connect parts of an assignment with descriptions of expected performance. For your comparison, read those descriptions alongside both drafts. A criterion name such as “analysis” is too broad to tell you what changed.

## 2. Turn one feedback comment into a testable edit

“Improve the evidence” is a starting point. A more useful revision task says where the problem is and what the reader needs to see.

For example: “In paragraph two, replace the claim about all students with the actual survey finding, then explain what that small sample cannot establish.” You can check whether the next draft does this without waiting for a new score.

Revision can involve changing ideas or organization, not only fixing sentences. [MTSU's revision guidance](https://writing-center.mtsu.edu/com10revision/) describes reviewing content and structure and suggests outlining an existing draft when its organization is unclear. If an essay's main claim does not answer the task, editing that claim may matter more than polishing every sentence first.

## 3. Worked example: compare the evidence in two versions

Everything in this exercise is fictional: the assignment, survey, rubric and paragraphs. The example is not a student submission, a real campus study or a RubriCheck evaluation.

**Practice task:** Recommend whether a campus library should extend its closing time from 8 p.m. to 10 p.m. Explain the evidence and a limitation.

**Material available to the writer:** A survey of 24 students at one afternoon event found that 15 wanted later opening and 9 did not. The material gives no information about staffing costs or whether respondents would actually visit after 8 p.m.

**Practice rubric:** Support the recommendation with the supplied evidence; explain how that evidence supports the decision; identify a limit that affects the conclusion. These are illustrative descriptors, not a university marking scheme.

### Version 1: a claim that goes beyond the evidence

> The library should close at 10 p.m. because all students need longer study hours. The survey proves that extending opening hours will solve the problem, so the change should happen immediately.

The paragraph gives a recommendation, but “all students” exceeds the survey's scope. It also treats a preference as proof of an outcome. Neither a cost estimate nor evidence that the change would solve the problem is available.

### Version 2: a narrower conclusion with an explicit limit

> The survey provides a reason to investigate later opening: 15 of the 24 respondents wanted it. However, one afternoon event does not represent every student's schedule, and a stated preference does not show how many people would visit after 8 p.m. A limited trial, with attendance and staffing costs recorded, would provide more relevant evidence before committing to a permanent change.

The revision now uses the supplied finding, explains its scope and proposes a way to investigate what remains unknown. It has not established that later opening is affordable or necessary. Those questions remain open.

### Compare by criterion, not by paragraph length

**Evidence:** Version 1 claims universal need. Version 2 reports the actual 15-of-24 finding. The improvement to check is accuracy and scope, not simply the addition of a number.

**Reasoning:** Version 1 jumps from preference to a guaranteed solution. Version 2 separates an indication of interest from evidence of actual use. The recommendation is more limited because the evidence is limited.

**Limitation:** Version 1 gives none. Version 2 identifies sampling, actual attendance and costs as unresolved. A real assignment may require a different decision or more sources; follow its instructions.

If your own problem is a paragraph that summarizes sources without explaining them, use the separate [critical analysis revision exercise](/blog/descriptive-vs-critical-analysis).

## 4. Keep a short revision log

Copy this four-line record for each important change. Fill it in with locations in your own draft rather than a general statement such as “made the essay better.”

- **Criterion:** Evidence supports the recommendation.
- **Earlier gap:** Paragraph two said “all students,” but the supplied survey covered only 24 respondents.
- **Edit made:** Replaced the universal claim with the observed count and explained the sample's limit.
- **Still to check:** Does the conclusion elsewhere in the essay make the same unsupported claim?

That last question matters. A careful body paragraph can still conflict with an exaggerated conclusion. After a local edit, reread the introduction, topic sentences and conclusion for consistency. Use the [assignment requirements checklist](/blog/assignment-requirements-checklist) for the final whole-file review.

## 5. Read a changed AI score alongside the drafts

Suppose an AI review displays **68–74** for one draft and **70–76** for the next. These numbers are invented for this explanation. The displayed endpoints moved by two points; that alone does not establish a two-point improvement or predict your instructor's grade.

RubriCheck's displayed ranges are AI estimates, not statistically calibrated confidence intervals. You cannot use the amount of overlap as a statistical test of whether your revision worked. AI estimates can still vary when you keep the rubric and mode the same.

Instead, return to your revision log. Does the newer feedback recognize the actual evidence you added? Does it point to a gap you can locate? Check a claim that seems wrong against the relevant passage and rubric descriptor before acting on it.

If a score changes unexpectedly, first confirm that both checks used the intended draft, complete rubric, same mode and readable files. An older saved result may also use an earlier scoring method; read any calculation notice attached to it before comparing totals. Repeatedly submitting an unchanged draft until a preferred number appears does not demonstrate a revision.

## 6. Use the next check to answer a specific question

In RubriCheck, signed-in users can organize saved evaluations in projects and open their versions. Use **New version** for a revised draft, then confirm the rubric and grading mode before evaluating. Open each saved result and compare its comments with the corresponding text and your revision log.

If you reviewed the first draft with general criteria, keep that basis for the comparison or clearly note when you switch to an instructor rubric. General criteria are useful for a broad review; they do not reproduce an instructor's marking scheme.

Choose a question such as “Does paragraph two now justify the recommendation using the supplied evidence?” Check the answer against the draft yourself. Re-evaluation uses the access and limits of your current plan; it is not a promise of unlimited free checks or a higher grade.

[Review my revised draft](/workspace#rubric-checker)

For more about applying comments, see the [rubric feedback guide](/rubric-feedback-tool). If you are starting your first review, the [essay rubric checker](/essay-rubric-checker) explains how to provide your essay and criteria.

## Sources and example notes

Source pages checked on 10 November 2026:

- [Carnegie Mellon University: Grading and Performance Rubrics](https://www.cmu.edu/teaching/designteach/teach/rubrics.html) — criteria, performance descriptions and feedback.
- [Middle Tennessee State University Writing Center: Revision Strategies](https://writing-center.mtsu.edu/com10revision/) — reviewing ideas, organization and wording during revision.

The library scenario, both paragraphs, practice descriptors, revision log and score ranges were created for this guide. The university pages provide general guidance; they do not validate the fictional example, endorse RubriCheck or establish its grading accuracy.
