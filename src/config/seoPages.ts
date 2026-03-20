import type { FaqItem } from "../lib/seo";

export type SeoSection = {
  title: string;
  body: string;
};

export type SeoLink = {
  href: string;
  label: string;
  description: string;
};

export type SeoLandingPageContent = {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  intro: string;
  primaryKeyword: string;
  keywords: string[];
  sections: SeoSection[];
  faqItems: FaqItem[];
  relatedLinks: SeoLink[];
  ctaLabel: string;
  ctaHref: string;
};

export const HOME_FAQ_ITEMS: FaqItem[] = [
  {
    question: "What does RubriCheck do?",
    answer:
      "RubriCheck compares your assignment draft against the rubric you upload, estimates likely score ranges, and highlights what to revise before submission.",
  },
  {
    question: "Who is RubriCheck for?",
    answer:
      "RubriCheck is built for students who want a rubric-based check before submitting essays, reports, and other graded assignments.",
  },
  {
    question: "Does RubriCheck give an official grade?",
    answer:
      "No. RubriCheck gives an AI-generated estimate and feedback so you can improve your draft before a teacher or professor grades it.",
  },
  {
    question: "What can I upload?",
    answer:
      "You can upload rubric files and assignment files in common document and image formats, or paste the text directly into RubriCheck.",
  },
];

export const HOME_INTERNAL_LINKS: SeoLink[] = [
  {
    href: "/rubric-checker",
    label: "Rubric checker",
    description: "A focused landing page for students searching for a rubric checker before submission.",
  },
  {
    href: "/ai-rubric-grader",
    label: "AI rubric grader",
    description: "Explains the score prediction and feedback workflow for rubric-based grading.",
  },
  {
    href: "/assignment-rubric-checker",
    label: "Assignment rubric checker",
    description: "Targets draft checks for reports, projects, and other assignment submissions.",
  },
  {
    href: "/essay-rubric-checker",
    label: "Essay rubric checker",
    description: "Targets essay-specific rubric feedback and revision guidance before you submit.",
  },
  {
    href: "/rubric-feedback-tool",
    label: "Rubric feedback tool",
    description: "Speaks to users who want criterion-level feedback instead of a single score only.",
  },
  {
    href: "/how-to-use-a-rubric-to-check-an-assignment",
    label: "How to use a rubric",
    description: "A practical guide for students who are learning how to self-check work with a rubric.",
  },
];

export const SEO_LANDING_PAGES: SeoLandingPageContent[] = [
  {
    slug: "rubric-checker",
    path: "/rubric-checker",
    title: "Rubric Checker for Assignments and Essays",
    description:
      "Use RubriCheck as a rubric checker to compare your draft against a grading rubric, estimate likely scores, and get revision guidance before submission.",
    h1: "Rubric Checker for Assignments and Essays",
    eyebrow: "Primary transactional keyword",
    intro:
      "RubriCheck helps students run a rubric check before they submit. Upload the rubric and draft, see where the draft is strongest or weakest, and revise the highest-impact criteria first.",
    primaryKeyword: "rubric checker",
    keywords: [
      "rubric checker",
      "assignment rubric checker",
      "essay rubric checker",
      "rubric check",
      "rubric feedback tool",
    ],
    sections: [
      {
        title: "Check the rubric before you submit",
        body:
          "Instead of guessing how a grader will read your work, compare the assignment against the rubric ahead of time and spot weak criteria early.",
      },
      {
        title: "See criterion-level strengths and risks",
        body:
          "RubriCheck breaks feedback down by criterion so you can tell which rubric rows are helping you and which ones need revision.",
      },
      {
        title: "Use score ranges, not false certainty",
        body:
          "The product estimates likely score ranges and explains why, which is more useful for revision than a single unsupported number.",
      },
      {
        title: "Move from feedback to revision quickly",
        body:
          "Students can use the improvement priorities to decide what to edit first before a final submission deadline.",
      },
    ],
    faqItems: [
      {
        question: "How is a rubric checker different from a normal essay checker?",
        answer:
          "A rubric checker evaluates your draft against the scoring criteria you were given, so the feedback is tied to the actual grading framework instead of generic writing advice.",
      },
      {
        question: "Can I use RubriCheck for non-essay assignments?",
        answer:
          "Yes. RubriCheck works for essays, reports, reflections, and other assignments as long as you can provide the rubric and the draft.",
      },
      {
        question: "Why use a rubric checker before submission?",
        answer:
          "It helps you find the most important scoring gaps before the instructor sees the final version, which can improve both confidence and final outcomes.",
      },
    ],
    relatedLinks: [
      {
        href: "/ai-rubric-grader",
        label: "AI rubric grader",
        description: "Learn how RubriCheck predicts score ranges from rubric criteria.",
      },
      {
        href: "/assignment-rubric-checker",
        label: "Assignment rubric checker",
        description: "See the assignment-specific version of the same workflow.",
      },
      {
        href: "/rubric-feedback-tool",
        label: "Rubric feedback tool",
        description: "Explore criterion-level feedback use cases.",
      },
    ],
    ctaLabel: "Try the rubric checker",
    ctaHref: "/",
  },
  {
    slug: "ai-rubric-grader",
    path: "/ai-rubric-grader",
    title: "AI Rubric Grader for Assignment Draft Feedback",
    description:
      "RubriCheck is an AI rubric grader that predicts likely score outcomes, highlights criterion-level gaps, and helps students revise before submission.",
    h1: "AI Rubric Grader for Assignment Drafts",
    eyebrow: "Commercial-intent keyword",
    intro:
      "This page targets students searching for an AI rubric grader, not a full LMS grader. RubriCheck is designed for draft review before submission, with estimated score ranges and actionable next steps.",
    primaryKeyword: "ai rubric grader",
    keywords: [
      "ai rubric grader",
      "rubric grader",
      "ai rubric checker",
      "grade prediction rubric tool",
      "assignment feedback tool",
    ],
    sections: [
      {
        title: "Built for pre-submission review",
        body:
          "RubriCheck is not trying to replace a teacher. It helps students understand how a draft may perform against the rubric before the real grade happens.",
      },
      {
        title: "Score prediction plus explanation",
        body:
          "The useful part of an AI rubric grader is not the number alone. RubriCheck pairs score ranges with feedback tied to each criterion.",
      },
      {
        title: "Faster iteration for tight deadlines",
        body:
          "When time is short, the tool surfaces the highest-impact revision priorities so you can focus on changes that are more likely to improve the score.",
      },
      {
        title: "Works across common assignment types",
        body:
          "Students can use the same workflow for essays, reports, and rubric-based assignments with uploaded files or pasted text.",
      },
    ],
    faqItems: [
      {
        question: "What is an AI rubric grader?",
        answer:
          "An AI rubric grader reviews a draft against grading criteria and estimates how the work may score. RubriCheck is built for that pre-submission use case.",
      },
      {
        question: "Does RubriCheck replace my instructor's grade?",
        answer:
          "No. RubriCheck gives an estimate and revision guidance only. The official grade still comes from the teacher or professor.",
      },
      {
        question: "Why target score ranges instead of one score?",
        answer:
          "Rubric-based grading has uncertainty. Score ranges set better expectations and are more honest about how a draft might perform.",
      },
    ],
    relatedLinks: [
      {
        href: "/rubric-checker",
        label: "Rubric checker",
        description: "See the broader page for rubric checking and feedback.",
      },
      {
        href: "/essay-rubric-checker",
        label: "Essay rubric checker",
        description: "Explore the essay-specific version for writing assignments.",
      },
      {
        href: "/rubric-feedback-tool",
        label: "Rubric feedback tool",
        description: "Focus on feedback-led revision rather than score only.",
      },
    ],
    ctaLabel: "Use the AI rubric grader",
    ctaHref: "/",
  },
  {
    slug: "assignment-rubric-checker",
    path: "/assignment-rubric-checker",
    title: "Assignment Rubric Checker for Draft Review",
    description:
      "Check assignment drafts against your grading rubric with RubriCheck. Upload the assignment and rubric, estimate likely scores, and revise before submission.",
    h1: "Assignment Rubric Checker",
    eyebrow: "High-intent assignment page",
    intro:
      "Students often search for a rubric checker right before they submit an assignment. This page is designed for that moment: upload the draft, compare it to the rubric, and see what to improve first.",
    primaryKeyword: "assignment rubric checker",
    keywords: [
      "assignment rubric checker",
      "rubric checker for assignments",
      "assignment rubric grader",
      "assignment feedback rubric tool",
    ],
    sections: [
      {
        title: "Built for real assignment workflows",
        body:
          "RubriCheck is useful when you already have the assignment draft and rubric and need a fast quality check before the deadline.",
      },
      {
        title: "Catch missing rubric requirements",
        body:
          "The tool can help you notice criteria that are thin, unclear, or unsupported before you hand in the final version.",
      },
      {
        title: "Prioritize revision effort",
        body:
          "Not every issue matters equally. RubriCheck helps students focus on the criteria most likely to affect the final score.",
      },
      {
        title: "Good fit for reports, projects, and reflections",
        body:
          "Any assignment with a clear rubric can benefit from a pre-submission rubric check, not just essays.",
      },
    ],
    faqItems: [
      {
        question: "When should I use an assignment rubric checker?",
        answer:
          "Use it after you have a workable draft but before final submission, so you still have time to revise based on the rubric.",
      },
      {
        question: "Can RubriCheck handle assignment files?",
        answer:
          "Yes. You can upload common document and image formats or paste the assignment text directly into the app.",
      },
      {
        question: "What kind of feedback do I get?",
        answer:
          "You get score-range estimates, criterion-level comments, and a short list of revision priorities based on the rubric.",
      },
    ],
    relatedLinks: [
      {
        href: "/rubric-checker",
        label: "Rubric checker",
        description: "Return to the broader rubric checker page.",
      },
      {
        href: "/essay-rubric-checker",
        label: "Essay rubric checker",
        description: "See the essay-focused version for writing-heavy assignments.",
      },
      {
        href: "/how-to-use-a-rubric-to-check-an-assignment",
        label: "How to use a rubric",
        description: "Read the supporting guide for self-checking assignments.",
      },
    ],
    ctaLabel: "Check an assignment draft",
    ctaHref: "/",
  },
  {
    slug: "essay-rubric-checker",
    path: "/essay-rubric-checker",
    title: "Essay Rubric Checker with AI Feedback",
    description:
      "Use RubriCheck as an essay rubric checker to estimate likely scores, review criterion-level feedback, and improve essays before submission.",
    h1: "Essay Rubric Checker with AI Feedback",
    eyebrow: "Essay-focused conversion page",
    intro:
      "Essay assignments are one of the clearest SEO entry points for RubriCheck. This page explains how students can use the product to compare an essay draft against a rubric before the final hand-in.",
    primaryKeyword: "essay rubric checker",
    keywords: [
      "essay rubric checker",
      "essay rubric grader",
      "ai rubric grader for essays",
      "essay feedback rubric tool",
    ],
    sections: [
      {
        title: "Check argument, structure, and evidence",
        body:
          "Essay rubrics often score multiple writing dimensions at once. RubriCheck helps students see where the draft is strong and where the rubric may still be unmet.",
      },
      {
        title: "Use rubric feedback before final edits",
        body:
          "Students can run a rubric-based check before polishing the final draft, which helps them avoid spending time on low-value edits first.",
      },
      {
        title: "Useful for school and university essays",
        body:
          "The workflow fits a wide range of rubric-based writing assignments, from high-school essays to college coursework.",
      },
      {
        title: "Turn feedback into rewrite priorities",
        body:
          "Criterion-level notes help students decide whether to strengthen evidence, clarify structure, or improve rubric alignment.",
      },
    ],
    faqItems: [
      {
        question: "Can I use RubriCheck for essay drafts only?",
        answer:
          "You can, but the tool also works for broader assignment types. This page is simply tailored for essay-related searches.",
      },
      {
        question: "What makes an essay rubric checker useful?",
        answer:
          "It keeps feedback anchored to the grading rubric so you can revise toward the criteria that actually influence your score.",
      },
      {
        question: "Will RubriCheck fix my essay for me?",
        answer:
          "RubriCheck focuses on evaluation and revision guidance. It helps you decide what to improve before submission rather than pretending to replace your writing process.",
      },
    ],
    relatedLinks: [
      {
        href: "/rubric-checker",
        label: "Rubric checker",
        description: "See the broader rubric checker page.",
      },
      {
        href: "/ai-rubric-grader",
        label: "AI rubric grader",
        description: "Learn more about the score prediction workflow.",
      },
      {
        href: "/rubric-feedback-tool",
        label: "Rubric feedback tool",
        description: "Focus on criterion-level feedback and revision planning.",
      },
    ],
    ctaLabel: "Check an essay draft",
    ctaHref: "/",
  },
  {
    slug: "how-to-use-a-rubric-to-check-an-assignment",
    path: "/how-to-use-a-rubric-to-check-an-assignment",
    title: "How to Use a Rubric to Check an Assignment",
    description:
      "Learn how to use a rubric to check an assignment before submission, with a simple step-by-step process and RubriCheck examples.",
    h1: "How to Use a Rubric to Check an Assignment",
    eyebrow: "Supporting informational page",
    intro:
      "This guide supports students who understand the need for rubric-based self-review but are not yet sure how to do it well. It also creates a natural internal-link bridge into the product pages.",
    primaryKeyword: "how to use a rubric to check an assignment",
    keywords: [
      "how to use a rubric to check an assignment",
      "how to check an assignment with a rubric",
      "assignment rubric checklist",
      "rubric self assessment",
    ],
    sections: [
      {
        title: "Step 1: Read the rubric before editing",
        body:
          "Identify what the grader will actually score. Rubrics often reveal that the next best revision is not the one students expect.",
      },
      {
        title: "Step 2: Match evidence to each criterion",
        body:
          "For every row in the rubric, ask whether the draft clearly proves the requirement or only hints at it.",
      },
      {
        title: "Step 3: Fix the weakest high-value criteria first",
        body:
          "Start with the criteria that carry the most weight or are furthest from the rubric standard, then polish lower-impact issues later.",
      },
      {
        title: "Step 4: Use RubriCheck for a faster final pass",
        body:
          "RubriCheck can speed up this self-review process by estimating likely outcomes and surfacing feedback tied to each criterion.",
      },
    ],
    faqItems: [
      {
        question: "Why should students check an assignment with a rubric?",
        answer:
          "Because the rubric defines how the work will be scored. Self-checking against it helps students focus on the revision work that matters most.",
      },
      {
        question: "Is a rubric useful even if the draft is incomplete?",
        answer:
          "Yes. An early rubric check can be especially useful because it helps you find major scoring gaps while there is still time to fix them.",
      },
      {
        question: "Where does RubriCheck fit into the process?",
        answer:
          "RubriCheck helps students run the rubric review faster by comparing the rubric and draft together and pointing out likely strengths and risks.",
      },
    ],
    relatedLinks: [
      {
        href: "/assignment-rubric-checker",
        label: "Assignment rubric checker",
        description: "Go from the guide into the assignment-focused product page.",
      },
      {
        href: "/rubric-checker",
        label: "Rubric checker",
        description: "See the main transactional page for rubric checking.",
      },
      {
        href: "/rubric-feedback-tool",
        label: "Rubric feedback tool",
        description: "Continue into the feedback-focused landing page.",
      },
    ],
    ctaLabel: "Try RubriCheck on a draft",
    ctaHref: "/",
  },
  {
    slug: "rubric-feedback-tool",
    path: "/rubric-feedback-tool",
    title: "Rubric Feedback Tool for Pre-Submission Review",
    description:
      "RubriCheck is a rubric feedback tool that gives criterion-level comments, score-range estimates, and revision priorities before submission.",
    h1: "Rubric Feedback Tool for Better Draft Revisions",
    eyebrow: "Feedback-led keyword cluster",
    intro:
      "Some students care less about the score estimate and more about where the draft is weak. This page targets that feedback-first intent while staying close to conversion.",
    primaryKeyword: "rubric feedback tool",
    keywords: [
      "rubric feedback tool",
      "rubric feedback",
      "criterion level feedback tool",
      "grade prediction rubric tool",
    ],
    sections: [
      {
        title: "Feedback tied to the rubric",
        body:
          "RubriCheck is useful because the feedback is grounded in the specific rubric instead of generic comments that may not affect the grade.",
      },
      {
        title: "Prioritized next steps for revision",
        body:
          "The goal is not just to point out issues. The tool helps students decide what to revise first to improve likely outcomes.",
      },
      {
        title: "Helpful before a final submission deadline",
        body:
          "A rubric feedback tool is most valuable when there is still time to act on the comments, making it a strong pre-submission product angle.",
      },
      {
        title: "Better context than a grammar checker alone",
        body:
          "Grammar tools can polish sentences, but rubric-based feedback helps students understand whether the work actually meets the grading criteria.",
      },
    ],
    faqItems: [
      {
        question: "What is a rubric feedback tool?",
        answer:
          "It is a tool that reviews a draft against a scoring rubric and returns feedback organized around the actual grading criteria.",
      },
      {
        question: "Does RubriCheck only give feedback?",
        answer:
          "No. RubriCheck also estimates likely score ranges, but this page emphasizes the feedback and revision workflow because that intent can convert well.",
      },
      {
        question: "When is rubric feedback most useful?",
        answer:
          "It is most useful when you still have time to revise before submission and want to focus effort on the most important scoring gaps.",
      },
    ],
    relatedLinks: [
      {
        href: "/rubric-checker",
        label: "Rubric checker",
        description: "Return to the broader transactional page.",
      },
      {
        href: "/ai-rubric-grader",
        label: "AI rubric grader",
        description: "See the score-prediction-focused landing page.",
      },
      {
        href: "/how-to-use-a-rubric-to-check-an-assignment",
        label: "How to use a rubric",
        description: "Read the supporting guide for rubric-based self-review.",
      },
    ],
    ctaLabel: "Get rubric-based feedback",
    ctaHref: "/",
  },
];

export function getSeoLandingPage(
  slug: SeoLandingPageContent["slug"],
): SeoLandingPageContent {
  const page = SEO_LANDING_PAGES.find((item) => item.slug === slug);

  if (!page) {
    throw new Error(`Unknown SEO landing page: ${slug}`);
  }

  return page;
}
