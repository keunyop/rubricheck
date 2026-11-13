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
export const BLOG_POSTS = [DISCUSSION_RESPONSE_POST, COMPARE_DRAFTS_POST, LAB_DISCUSSION_POST, REFLECTIVE_WRITING_POST, QUIZ_GENERATOR_POST, CRITICAL_ANALYSIS_POST, BLOG_POST];
export type BlogPost = (typeof BLOG_POSTS)[number];
