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
  title: "The RubriCheck Blog: Small Steps to a Stronger Draft",
  description: "Practical essay revision guides with worked examples. Understand your rubric, explain your evidence, and choose the next improvement for your draft.",
};

export const CRITICAL_ANALYSIS_POST = {
  slug: "descriptive-vs-critical-analysis",
  path: "/blog/descriptive-vs-critical-analysis",
  title: "Essay Too Descriptive? How to Add Critical Analysis",
  description: "Turn descriptive writing into critical analysis with a worked paragraph, a rubric example and a five-minute revision checklist for your university essay.",
  date: "2026-11-02", modified: "2026-11-02", category: "Critical writing",
} as const;
export const BLOG_POSTS = [CRITICAL_ANALYSIS_POST, BLOG_POST];
export type BlogPost = (typeof BLOG_POSTS)[number];
