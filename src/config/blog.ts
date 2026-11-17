// Editorial dates change only when the article changes, never at build time.
export const BLOG_POST = {
  slug: "assignment-requirements-checklist",
  path: "/blog/assignment-requirements-checklist",
  title: "Assignment Requirements Checklist: 5 Checks Before Submission",
  description: "Check your assignment requirements before submitting. Turn instructions into a five-point checklist, compare them with your rubric, and find missing work in a short example.",
  date: "2026-11-02",
  modified: "2026-11-02",
  category: "Assignment revision",
} as const;
export const BLOG_INDEX = {
  path: "/blog",
  title: "The RubriCheck Blog: Writing and Study Guides",
  description: "Practical writing and study guides with worked examples. Check your assignment, strengthen critical or reflective writing, and turn course notes into useful practice quizzes.",
};

export const CRITICAL_ANALYSIS_POST = {
  slug: "descriptive-vs-critical-analysis",
  path: "/blog/descriptive-vs-critical-analysis",
  title: "Essay Too Descriptive? How to Add Critical Analysis",
  description: "Turn descriptive writing into critical analysis with a worked paragraph, a rubric example and a five-minute revision checklist for your university essay.",
  date: "2026-11-02", modified: "2026-11-02", category: "Critical writing",
} as const;
export const QUIZ_GENERATOR_POST = {
  slug: "quiz-generator-from-notes",
  path: "/blog/quiz-generator-from-notes",
  title: "Quiz Generator from Notes: Turn a PDF into Useful Practice",
  description: "Turn lecture notes, PDFs or slides into a focused study quiz. Follow a worked example, check AI answers against your source, and review mistakes with RubriCheck.",
  date: "2026-11-04", modified: "2026-11-04", category: "Study and retrieval practice",
} as const;
export const REFLECTIVE_WRITING_POST = {
  slug: "reflective-writing-what-so-what-now-what",
  path: "/blog/reflective-writing-what-so-what-now-what",
  title: "Reflective Writing Example: Move from What? to So What?",
  description: "Use a worked reflective writing example to move from description to analysis and a specific action plan, then check the draft against your marking rubric.",
  date: "2026-11-05", modified: "2026-11-05", category: "Reflective writing",
} as const;
export const LAB_DISCUSSION_POST = {
  slug: "lab-report-discussion-example",
  path: "/blog/lab-report-discussion-example",
  title: "Lab Report Discussion Example: Explain Results and Limitations",
  description: "Write a lab report discussion that explains your results instead of repeating them. Use a worked example, a specific limitation and a rubric-based revision checklist.",
  date: "2026-11-08", modified: "2026-11-08", category: "Scientific writing",
} as const;
export const COMPARE_DRAFTS_POST = {
  slug: "compare-essay-drafts-with-rubric",
  path: "/blog/compare-essay-drafts-with-rubric",
  title: "How to Compare Essay Drafts with the Same Rubric",
  description: "Compare two essay drafts with the same rubric. Use a worked revision log to check stronger evidence, interpret AI score ranges and choose your next edit.",
  date: "2026-11-10", modified: "2026-11-10", category: "Assignment revision", readingMinutes: 7,
} as const;
export const DISCUSSION_RESPONSE_POST = {
  slug: "discussion-board-response-example",
  path: "/blog/discussion-board-response-example",
  title: "Discussion Board Response Example: Add Evidence and Move the Conversation Forward",
  description: "See a discussion board response example that answers a classmate with course evidence and a useful question. Revise a weak reply and check it against your rubric.",
  date: "2026-11-12", modified: "2026-11-12", category: "Online discussion", readingMinutes: 6,
} as const;
export const COUNTERARGUMENT_POST = {
  slug: "counterargument-paragraph-example",
  path: "/blog/counterargument-paragraph-example",
  title: "Counterargument Paragraph Example: Answer an Objection Fairly",
  description: "Build a counterargument paragraph with a fair objection, a concession and a reasoned response. Use a worked example and check the revision against your rubric.",
  date: "2026-11-13", modified: "2026-11-13", category: "Argumentative writing", readingMinutes: 6,
} as const;
export const EXPLAIN_EVIDENCE_POST = {
  slug: "explain-evidence-in-an-essay",
  path: "/blog/explain-evidence-in-an-essay",
  title: "How to Explain Evidence in an Essay Paragraph (With an Example)",
  description: "Learn how to explain evidence in an essay paragraph with a worked before-and-after example, a source-use checklist and a rubric-based revision step.",
  date: "2026-11-14", modified: "2026-11-14", category: "Academic writing", readingMinutes: 7,
} as const;
export const NO_RUBRIC_ESSAY_POST = {
  slug: "check-essay-without-rubric",
  path: "/blog/check-essay-without-rubric",
  title: "How to Check an Essay Without a Rubric",
  description: "No grading rubric? Use your assignment prompt and general writing criteria to check an essay draft, with a worked example and an honest first-review checklist.",
  date: "2026-11-15", modified: "2026-11-15", category: "Essay revision", readingMinutes: 7,
} as const;
export const RUBRIC_FEEDBACK_REVISION_POST = {
  slug: "turn-rubric-feedback-into-revisions",
  path: "/blog/turn-rubric-feedback-into-revisions",
  title: "How to Turn Rubric Feedback into a Revision Plan",
  description: "Turn a vague rubric comment into a specific edit. Use a worked comparison paragraph, a four-step revision map, and a check before you resubmit.",
  date: "2026-11-16", modified: "2026-11-16", category: "Assignment revision", readingMinutes: 7,
} as const;
export const RUBRIC_POINTS_POST = {
  slug: "check-rubric-points-and-weights",
  path: "/blog/check-rubric-points-and-weights",
  title: "How to Check Rubric Points and Weights Before Reviewing a Draft",
  description: "Check whether rubric row points add to the stated total, distinguish points from weights, and spot missing scoring details with a worked example.",
  date: "2026-11-17", modified: "2026-11-17", category: "Using a rubric", readingMinutes: 6,
} as const;
export const BLOG_POSTS = [RUBRIC_POINTS_POST, RUBRIC_FEEDBACK_REVISION_POST, NO_RUBRIC_ESSAY_POST, EXPLAIN_EVIDENCE_POST, COUNTERARGUMENT_POST, DISCUSSION_RESPONSE_POST, COMPARE_DRAFTS_POST, LAB_DISCUSSION_POST, REFLECTIVE_WRITING_POST, QUIZ_GENERATOR_POST, CRITICAL_ANALYSIS_POST, BLOG_POST];
export type BlogPost = (typeof BLOG_POSTS)[number];
