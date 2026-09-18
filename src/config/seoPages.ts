import type { FaqItem } from "../lib/seo";
import { FREE_TRIAL_LIMIT } from "./plans";

// Change only when the public content is substantially revised, never at build time.
export const SEO_CONTENT_UPDATED_AT = "2026-09-14";

export type SeoSection = { title: string; body: string };
export type SeoLink = { href: string; label: string; description: string };
export type SeoExample = {
  title: string;
  description: string;
  columns: [string, string, string];
  rows: [string, string, string][];
  note: string;
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
  example: SeoExample;
  faqItems: FaqItem[];
  relatedLinks: SeoLink[];
  ctaLabel: string;
  ctaHref: string;
};

export const HOME_FAQ_ITEMS: FaqItem[] = [
  {
    "question": "What does RubriCheck do?",
    "answer": "RubriCheck compares your essay or assignment draft with the rubric you provide, estimates score ranges, and highlights revision priorities before submission."
  },
  {
    "question": "How can I check my essay against a rubric?",
    "answer": "Add your essay and the full rubric in the separate input fields, then run an evaluation. Compare the results with each rubric criterion and revise the gaps that matter most to your assignment."
  },
  {
    "question": "Is RubriCheck free to try?",
    "answer": `Explore a prepared sample or get one summary-only preview of your own assignment without signing up. Sign up for ${FREE_TRIAL_LIMIT} free checks with no card required, including estimated scores and the leading improvement priority. Detailed criterion feedback and Strict mode require credits or Pro; rewrite suggestions require Pro.`
  },
  {
    "question": "Does RubriCheck give an official grade?",
    "answer": "No. RubriCheck gives AI-generated estimates and revision guidance. Your instructor determines the official grade, and you should review feedback against the original rubric."
  },
  {
    "question": "What can I upload?",
    "answer": "Upload your rubric and assignment as PDF, DOCX, TXT, PNG, JPG, or JPEG files, or paste their text. Include readable text, complete rubric rows, and all relevant assignment pages."
  }
];

export const HOME_INTERNAL_LINKS: SeoLink[] = [
  {
    "href": "/rubric-checker",
    "label": "How a rubric checker works",
    "description": "Turn grading criteria into a clear checklist for your draft."
  },
  {
    "href": "/ai-rubric-grader",
    "label": "AI rubric grader",
    "description": "Understand estimated scores, grading modes, and their limits."
  },
  {
    "href": "/assignment-rubric-checker",
    "label": "Assignment rubric checker",
    "description": "Check requirements in reports, projects, and reflections."
  },
  {
    "href": "/essay-rubric-checker",
    "label": "Check your essay against a rubric",
    "description": "Review your thesis, evidence, analysis, and essay structure."
  },
  {
    "href": "/rubric-feedback-tool",
    "label": "Rubric feedback tool",
    "description": "Turn criterion-level feedback into a practical revision plan."
  },
  {
    "href": "/how-to-use-a-rubric-to-check-an-assignment",
    "label": "How to use a rubric",
    "description": "Follow a worked example to self-check an assignment."
  }
];

export const SEO_LANDING_PAGES: SeoLandingPageContent[] = [
  {
    "slug": "rubric-checker",
    "title": "How a Rubric Checker Works: Criteria and Feedback",
    "description": "Learn how to check a draft against a rubric, prepare your scoring criteria, and turn feedback into revisions. Includes a rubric checklist example.",
    "h1": "How to Check Your Draft Against a Rubric",
    "eyebrow": "Understand your grading criteria",
    "intro": "A rubric checker compares your draft with the criteria and performance levels in your grading rubric. RubriCheck helps you see where the assignment meets those expectations, where evidence is missing, and what to revise before you submit.",
    "primaryKeyword": "rubric checker",
    "keywords": [
      "rubric checker",
      "rubric check",
      "rubric alignment checker"
    ],
    "sections": [
      {
        "title": "What does a rubric checker check?",
        "body": "The rubric defines the review. If it awards points for evidence, organization, and reflection, those are the areas to examine in your draft. A requirement such as a source count or a specific section needs to appear in the rubric or the instructions you provide; the tool cannot infer your instructor's unstated expectations."
      },
      {
        "title": "Prepare the complete rubric",
        "body": "Include criterion names, point values or weights, and the descriptions for each performance level. Check that an uploaded table has readable row and column headings. Missing descriptors can make the difference between satisfactory and excellent work difficult to judge."
      },
      {
        "title": "Add the draft you actually plan to submit",
        "body": "Upload the assignment alongside the rubric, or paste both texts into their separate fields. RubriCheck accepts PDF, DOCX, TXT, PNG, JPG, and JPEG files. For images, make sure the text is readable and no rubric rows or assignment pages are cut off."
      },
      {
        "title": "Use the results to choose your next edit",
        "body": "Read the estimated score range alongside the criteria. Find one unmet requirement, locate the relevant passage, and make a specific change. After revising, check the draft against the original rubric again; a score estimate is guidance for review, not an official grade."
      }
    ],
    "example": {
      "title": "Example: turn a rubric into a draft checklist",
      "description": "Use each performance descriptor to ask a question you can answer with evidence from your draft.",
      "columns": [
        "Rubric requirement",
        "Question to ask",
        "Evidence to locate"
      ],
      "rows": [
        [
          "Clear argument",
          "Does my opening state a position that the paper supports?",
          "The thesis and the claims in each body section."
        ],
        [
          "Relevant evidence",
          "Does each major claim have support and an explanation?",
          "A source, example, or result linked to each claim."
        ],
        [
          "Organization",
          "Can the reader follow the reasoning between sections?",
          "Topic sentences and transitions that connect the argument."
        ]
      ],
      "note": "Illustrative checklist. Your instructor's rubric determines the criteria and weights for your assignment."
    },
    "faqItems": [
      {
        "question": "Is a rubric checker the same as a grammar checker?",
        "answer": "A rubric checker reviews the criteria you provide, which may include reasoning, evidence, structure, or subject knowledge. Grammar is one possible criterion. A grammar checker mainly helps with sentence-level writing issues."
      },
      {
        "question": "Can I check an assignment without a rubric?",
        "answer": "RubriCheck needs rubric criteria to evaluate the draft. If you only have assignment instructions, first turn the explicit requirements into a review checklist. Ask your instructor about any missing weights or grading expectations."
      },
      {
        "question": "Is RubriCheck free to try?",
        "answer": `RubriCheck includes ${FREE_TRIAL_LIMIT} free trial evaluations. Detailed criterion feedback and Strict mode require credits or Pro; rewrite suggestions require Pro. See pricing for the current plan details.`
      }
    ],
    "ctaLabel": "Check my draft",
    "path": "/rubric-checker",
    "relatedLinks": [
      {
        "href": "/essay-rubric-checker",
        "label": "Check your essay against a rubric",
        "description": "Review your thesis, evidence, analysis, and essay structure."
      },
      {
        "href": "/ai-rubric-grader",
        "label": "AI rubric grader",
        "description": "Understand estimated scores, grading modes, and their limits."
      },
      {
        "href": "/how-to-use-a-rubric-to-check-an-assignment",
        "label": "How to use a rubric",
        "description": "Follow a worked example to self-check an assignment."
      }
    ],
    "ctaHref": "/#rubric-checker"
  },
  {
    "slug": "ai-rubric-grader",
    "title": "AI Rubric Grader: Estimate Your Assignment Score",
    "description": "Grade your draft against your own rubric with AI. See estimated score ranges and revision priorities, and learn how Standard and Strict modes differ.",
    "h1": "AI Rubric Grader for Assignment Drafts",
    "eyebrow": "Understand your estimated score",
    "intro": "RubriCheck is an AI rubric grader that compares your assignment with the grading criteria you provide. Use the estimated score range to identify weaker areas and plan revisions before your instructor gives the official grade.",
    "primaryKeyword": "ai rubric grader",
    "keywords": [
      "ai rubric grader",
      "rubric grader",
      "ai grader with rubric"
    ],
    "sections": [
      {
        "title": "How the AI rubric grader uses your rubric",
        "body": "Provide the scoring rows, available points, and performance descriptions along with your draft. RubriCheck structures the rubric and evaluates the assignment against its criteria. Supplying the complete descriptors gives the review more context than criterion names alone."
      },
      {
        "title": "How to interpret a score range",
        "body": "An estimated range reflects uncertainty in interpreting the rubric and the work. It is not a measured probability or a promise of your final mark. Read the criterion results before deciding what to change, especially when a rubric uses broad descriptions such as insightful or thorough."
      },
      {
        "title": "Standard and Strict grading modes",
        "body": "Standard mode provides the regular draft evaluation. Strict mode offers a more demanding review of rubric alignment and is available with credits or Pro. Choose the mode that helps your revision process; neither mode can reproduce every instructor's grading judgment."
      },
      {
        "title": "When a score estimate needs a closer look",
        "body": "Check the original draft when feedback seems to overlook a passage or interpret a requirement differently. Missing rubric rows, unclear image text, and incomplete drafts can affect the review. Use your instructor's explanations to resolve ambiguity, and keep the final submission in your own voice."
      }
    ],
    "example": {
      "title": "Example: read criterion scores before the total",
      "description": "A total alone does not tell you whether to work on reasoning, evidence, or presentation.",
      "columns": [
        "Illustrative criterion",
        "Estimated points",
        "Revision to consider"
      ],
      "rows": [
        [
          "Evidence (40 points)",
          "24–29 / 40",
          "Explain how each source supports the main claim."
        ],
        [
          "Analysis (40 points)",
          "25–30 / 40",
          "Connect the findings to the argument instead of only describing them."
        ],
        [
          "Presentation (20 points)",
          "16–18 / 20",
          "Check heading consistency and required formatting."
        ]
      ],
      "note": "Invented scoring example, not a product result or an accuracy claim. The possible combined range here is 65–77 out of 100."
    },
    "faqItems": [
      {
        "question": "Can AI grade my assignment with my own rubric?",
        "answer": "RubriCheck accepts your rubric and assignment draft together, so the evaluation can follow your supplied criteria and weights. You still need to check the feedback and use your instructor's rubric as the final reference."
      },
      {
        "question": "How accurate is an AI rubric grade?",
        "answer": "Accuracy depends on the rubric, input quality, assignment, and the instructor's interpretation. RubriCheck provides an estimate, and does not guarantee agreement with a teacher's grade or a particular improvement."
      },
      {
        "question": "Do I need Pro to use an AI rubric grader?",
        "answer": `You can start with ${FREE_TRIAL_LIMIT} free trial evaluations in Standard mode. Credits or Pro unlock detailed criterion feedback and Strict mode. Pro also provides rewrite suggestions.`
      }
    ],
    "ctaLabel": "Estimate my draft's score",
    "path": "/ai-rubric-grader",
    "relatedLinks": [
      {
        "href": "/rubric-checker",
        "label": "How a rubric checker works",
        "description": "Turn grading criteria into a clear checklist for your draft."
      },
      {
        "href": "/assignment-rubric-checker",
        "label": "Assignment rubric checker",
        "description": "Check requirements in reports, projects, and reflections."
      },
      {
        "href": "/rubric-feedback-tool",
        "label": "Rubric feedback tool",
        "description": "Turn criterion-level feedback into a practical revision plan."
      }
    ],
    "ctaHref": "/#rubric-checker"
  },
  {
    "slug": "assignment-rubric-checker",
    "title": "Assignment Rubric Checker: Check Before You Submit",
    "description": "Check your assignment against its rubric. Find missing requirements in reports, reflections, and projects, then choose what to revise before submission.",
    "h1": "Check Your Assignment Against the Rubric",
    "eyebrow": "Review assignment requirements",
    "intro": "Use RubriCheck to compare a report, reflection, or written project with its assignment rubric. Upload the draft and grading criteria to see estimated scores and revision priorities while you still have time to make changes.",
    "primaryKeyword": "assignment rubric checker",
    "keywords": [
      "assignment rubric checker",
      "check assignment against rubric",
      "assignment criteria checker"
    ],
    "sections": [
      {
        "title": "Bring together the rubric and instructions",
        "body": "An assignment brief may contain requirements that are absent from the scoring table, such as a required section or an explanation of your method. Include relevant written instructions with the rubric text so the review has that context. Keep the instructor's original scoring weights intact."
      },
      {
        "title": "Check reports for method, findings, and interpretation",
        "body": "For a report, locate the passages that explain what you did, what you found, and why the findings matter. A rubric may award separate marks for each. A detailed results section does not necessarily satisfy a separate requirement to interpret limitations or discuss alternatives."
      },
      {
        "title": "Check reflections for reasoning and specific examples",
        "body": "A reflection often needs more than a description of what happened. Compare your writing with criteria about learning, connections to course concepts, and future action. Point to a concrete experience and explain how it changed your understanding or what you will do differently."
      },
      {
        "title": "Complete a final submission check",
        "body": "Use the rubric review to prioritize content revisions, then check the actual submission file for the required name, format, attachments, and deadline. RubriCheck evaluates the material you provide; it cannot verify an upload in your school's submission portal or inspect work you have not included."
      }
    ],
    "example": {
      "title": "Example: check a project report for missing requirements",
      "description": "Map each requirement to a specific place in the report before marking it complete.",
      "columns": [
        "Requirement",
        "What is in the draft",
        "Next action"
      ],
      "rows": [
        [
          "Explain the method",
          "Lists the steps but gives no reason for choosing them.",
          "Add a short justification for the approach."
        ],
        [
          "Interpret the results",
          "Includes a chart and repeats the values.",
          "Explain the pattern and its relevance to the question."
        ],
        [
          "Discuss limitations",
          "Says the sample was small.",
          "Explain how sample size affects the conclusions."
        ]
      ],
      "note": "Illustrative report review. Use the requirements and evidence from your own assignment."
    },
    "faqItems": [
      {
        "question": "Can I check assignments other than essays?",
        "answer": "Yes. You can provide reports, reflections, and written project work with a rubric. For work such as a presentation or practical task, only the text or images you supply can be reviewed; live delivery and unprovided work cannot be assessed."
      },
      {
        "question": "Which assignment and rubric files are supported?",
        "answer": "You can upload PDF, DOCX, TXT, PNG, JPG, or JPEG files, or paste text. Check image readability and include all relevant pages of both the rubric and draft."
      },
      {
        "question": "When should I check my assignment?",
        "answer": "Run a check once you have enough of a draft to compare with the rubric, leaving time for revision. After editing, do a final manual pass through the instructions and the file you will submit."
      }
    ],
    "ctaLabel": "Check my assignment",
    "path": "/assignment-rubric-checker",
    "relatedLinks": [
      {
        "href": "/essay-rubric-checker",
        "label": "Check your essay against a rubric",
        "description": "Review your thesis, evidence, analysis, and essay structure."
      },
      {
        "href": "/how-to-use-a-rubric-to-check-an-assignment",
        "label": "How to use a rubric",
        "description": "Follow a worked example to self-check an assignment."
      },
      {
        "href": "/rubric-feedback-tool",
        "label": "Rubric feedback tool",
        "description": "Turn criterion-level feedback into a practical revision plan."
      }
    ],
    "ctaHref": "/#rubric-checker"
  },
  {
    "slug": "essay-rubric-checker",
    "title": "Essay Rubric Checker: Check Your Essay Against a Rubric",
    "description": "Check your essay against your rubric for thesis, evidence, analysis, and structure. Get estimated scores and decide what to revise before you submit.",
    "h1": "Check Your Essay Against a Rubric",
    "eyebrow": "Review your essay before submission",
    "intro": "To check your essay against a rubric, compare each grading criterion with evidence in your draft. RubriCheck reviews your essay and your own rubric together so you can identify gaps in the argument, supporting evidence, and structure before submitting.",
    "primaryKeyword": "essay rubric checker",
    "keywords": [
      "essay rubric checker",
      "check my essay against rubric",
      "check essay against rubric",
      "essay checker with rubric"
    ],
    "sections": [
      {
        "title": "1. Upload your essay and the complete rubric",
        "body": "Keep the essay and rubric in their separate input fields. Upload PDF, DOCX, TXT, PNG, JPG, or JPEG files, or paste the text. Include the rubric's performance levels and point values so the check can distinguish a basic response from the standard required for higher marks."
      },
      {
        "title": "2. Check your thesis and paragraph claims",
        "body": "Find the sentence that answers the essay question and states your position. Then read each paragraph's main claim in order. If the claims drift from the thesis, revise the structure before polishing individual sentences. The rubric may also require a counterargument or a specific type of analysis."
      },
      {
        "title": "3. Connect evidence to your reasoning",
        "body": "A quotation or citation does not explain itself. For each major claim, identify the evidence and the sentence explaining how it supports the argument. Verify quotations, source details, and citation style against the original sources yourself; rubric feedback is not a substitute for checking references."
      },
      {
        "title": "4. Revise the highest-priority gap",
        "body": "Use the criterion results and revision priorities to choose your next edit. If analysis carries more marks than mechanics and your draft mostly summarizes sources, deepen the explanation before spending all your time on punctuation. Compare the revised passage with the rubric descriptor again."
      }
    ],
    "example": {
      "title": "Example: check an essay paragraph against the rubric",
      "description": "Suppose the rubric asks for a clear claim, relevant evidence, and an explanation connecting the two.",
      "columns": [
        "Criterion",
        "Draft evidence",
        "Possible revision"
      ],
      "rows": [
        [
          "Claim",
          "The paragraph introduces the topic but takes no position.",
          "State the point the paragraph will establish."
        ],
        [
          "Evidence",
          "A quotation appears without context.",
          "Introduce the source and explain why it is relevant."
        ],
        [
          "Analysis",
          "The paragraph ends immediately after the quotation.",
          "Explain how the evidence supports the thesis and address its limits."
        ]
      ],
      "note": "Illustrative essay review, not a submitted student's work or a generated evaluation. Apply your own rubric's descriptors."
    },
    "faqItems": [
      {
        "question": "How can I check my essay against a rubric?",
        "answer": "Read each rubric row, find the passage in your essay that meets it, and compare that passage with the performance-level descriptions. Mark missing evidence and revise the most important gaps. In RubriCheck, add your essay and rubric together to get an AI-assisted review."
      },
      {
        "question": "Can I use my professor's essay rubric?",
        "answer": "Yes. Supply the full rubric, including the criteria, points or weights, and performance descriptions. Include relevant assignment instructions if they explain requirements not stated in the rubric."
      },
      {
        "question": "Will RubriCheck write or fix the essay for me?",
        "answer": "The rubric check provides estimated scores and revision guidance. Detailed feedback is available with credits or Pro, and rewrite suggestions are a Pro feature. Review suggestions yourself and make sure your final writing follows your course's rules."
      }
    ],
    "ctaLabel": "Check my essay",
    "path": "/essay-rubric-checker",
    "relatedLinks": [
      {
        "href": "/assignment-rubric-checker",
        "label": "Assignment rubric checker",
        "description": "Check requirements in reports, projects, and reflections."
      },
      {
        "href": "/rubric-feedback-tool",
        "label": "Rubric feedback tool",
        "description": "Turn criterion-level feedback into a practical revision plan."
      },
      {
        "href": "/how-to-use-a-rubric-to-check-an-assignment",
        "label": "How to use a rubric",
        "description": "Follow a worked example to self-check an assignment."
      }
    ],
    "ctaHref": "/#rubric-checker"
  },
  {
    "slug": "how-to-use-a-rubric-to-check-an-assignment",
    "title": "How to Use a Rubric to Check an Assignment",
    "description": "Use this step-by-step rubric checklist and worked example to review an assignment, match evidence to criteria, and prioritize revisions before submission.",
    "h1": "How to Use a Rubric to Check an Assignment",
    "eyebrow": "A practical self-review guide",
    "intro": "Use a rubric as a checklist for the evidence your assignment needs to contain. Read the criteria, find supporting passages in your draft, compare them with the performance descriptions, and revise the largest gaps before submission.",
    "primaryKeyword": "how to use a rubric to check an assignment",
    "keywords": [
      "how to use a rubric",
      "assignment rubric checklist",
      "rubric self assessment"
    ],
    "sections": [
      {
        "title": "Step 1: Separate criteria, levels, and weights",
        "body": "Criteria describe what is assessed, such as analysis or use of evidence. Performance levels describe how well you must demonstrate it, and weights indicate its share of the grade. Copy each criterion into a checklist and keep its highest-level descriptor beside it so you can review them together."
      },
      {
        "title": "Step 2: Locate evidence in the draft",
        "body": "For each criterion, record a paragraph, section, or figure that demonstrates it. Avoid marking a row complete just because you mentioned the topic. If the rubric says evaluate two approaches, look for an actual comparison and judgment about those approaches, not two separate descriptions."
      },
      {
        "title": "Step 3: Choose a level and explain why",
        "body": "Compare the passage with the full descriptor at each level. Record both what meets the standard and what is missing. When your draft sits between two levels, write down the uncertainty instead of automatically choosing the higher score; that gap can become a useful revision task."
      },
      {
        "title": "Step 4: Prioritize, revise, and check again",
        "body": "Start with missing requirements and substantial weaknesses in heavily weighted criteria. Convert each gap into a specific edit, such as explaining a limitation or connecting evidence to a claim. After revision, repeat the checklist and confirm that the final file satisfies the assignment instructions."
      }
    ],
    "example": {
      "title": "Worked example: choose the next revision",
      "description": "In this invented 100-point rubric, analysis and evidence carry most of the marks. The notes turn a broad self-rating into edits you can make.",
      "columns": [
        "Criterion and weight",
        "Self-check evidence",
        "Revision decision"
      ],
      "rows": [
        [
          "Analysis — 40%",
          "Describes two approaches but does not compare them.",
          "Add a comparison using the same measures for both approaches."
        ],
        [
          "Evidence — 35%",
          "Sources support the first approach only.",
          "Find relevant support for the second approach and explain it."
        ],
        [
          "Organization — 25%",
          "Sections follow a clear order; one transition is abrupt.",
          "Add a transition after addressing analysis and evidence."
        ]
      ],
      "note": "Illustrative weights, not a universal marking scheme. You can use this process manually or use RubriCheck to assist the review."
    },
    "faqItems": [
      {
        "question": "How do I turn a rubric into a checklist?",
        "answer": "Create one row for each criterion. Include its weight, the performance descriptor you are working toward, a place to record evidence from your draft, and a specific revision task. Check each row again after editing."
      },
      {
        "question": "How do I calculate a weighted rubric score?",
        "answer": "If a rubric gives weights rather than points, divide each criterion score by its maximum, multiply by that criterion's percentage weight, and add the results. For example, 3 out of 4 on a criterion weighted at 40% contributes 30 percentage points. Follow any different calculation specified by your instructor."
      },
      {
        "question": "Where does RubriCheck fit into self-review?",
        "answer": "After preparing the rubric and draft, use RubriCheck for an estimated score range and revision priorities. Compare the suggestions with your own checklist and verify the relevant passages before accepting or rejecting a suggestion."
      }
    ],
    "ctaLabel": "Review my draft with RubriCheck",
    "path": "/how-to-use-a-rubric-to-check-an-assignment",
    "relatedLinks": [
      {
        "href": "/assignment-rubric-checker",
        "label": "Assignment rubric checker",
        "description": "Check requirements in reports, projects, and reflections."
      },
      {
        "href": "/essay-rubric-checker",
        "label": "Check your essay against a rubric",
        "description": "Review your thesis, evidence, analysis, and essay structure."
      },
      {
        "href": "/rubric-checker",
        "label": "How a rubric checker works",
        "description": "Turn grading criteria into a clear checklist for your draft."
      }
    ],
    "ctaHref": "/#rubric-checker"
  },
  {
    "slug": "rubric-feedback-tool",
    "title": "Rubric Feedback Tool: Know What to Revise Next",
    "description": "Get feedback tied to your rubric and turn scoring gaps into specific edits. See a worked example of criterion feedback and a practical revision plan.",
    "h1": "Rubric Feedback That Helps You Revise",
    "eyebrow": "From criteria to practical edits",
    "intro": "RubriCheck organizes assignment feedback around your grading rubric. Use it to understand which requirements need attention, connect comments to your draft, and choose a specific next revision before submission.",
    "primaryKeyword": "rubric feedback tool",
    "keywords": [
      "rubric feedback tool",
      "rubric feedback",
      "rubric based feedback"
    ],
    "sections": [
      {
        "title": "Read the criterion before the comment",
        "body": "Start with the rubric row that the feedback refers to. A comment about evidence can mean that you need another source, a more relevant example, or a clearer explanation of a source you already used. Compare the comment with the descriptor and the passage before deciding what to add."
      },
      {
        "title": "Turn broad feedback into a visible edit",
        "body": "Replace a vague task such as improve analysis with a concrete action you can complete. For example, add two sentences explaining why the result supports the claim, then discuss one limitation. Each revision should make the rubric requirement easier for a reader to identify in the draft."
      },
      {
        "title": "Prioritize feedback with the rubric's weights",
        "body": "Fix missing requirements and major reasoning gaps first, especially in heavily weighted criteria. RubriCheck provides a leading improvement priority in the free trial. Credits or Pro unlock detailed criterion feedback and three improvement priorities to help plan a fuller revision."
      },
      {
        "title": "Review feedback with your own judgment",
        "body": "Check whether a comment is supported by the actual text. If the relevant explanation is already present, improve its clarity or placement only if that will help the reader. You can use feedback in a tutoring discussion, but your instructor's requirements remain the reference for the final submission."
      }
    ],
    "example": {
      "title": "Example: turn a feedback comment into a revision",
      "description": "Keep the criterion, the suggested change, and a final check together as you edit.",
      "columns": [
        "Criterion and feedback",
        "Concrete edit",
        "How to check the revision"
      ],
      "rows": [
        [
          "Evidence: support is not explained.",
          "Add a sentence after the example linking it to the claim.",
          "Can a reader follow the link without guessing?"
        ],
        [
          "Analysis: alternatives are not considered.",
          "Compare a plausible alternative and explain your judgment.",
          "Does the paragraph evaluate rather than just list options?"
        ],
        [
          "Structure: the section's purpose is unclear.",
          "Rewrite the topic sentence and connect it to the thesis.",
          "Does the section advance the essay's main argument?"
        ]
      ],
      "note": "Illustrative feedback and revision tasks. These are examples, not guaranteed comments from an evaluation."
    },
    "faqItems": [
      {
        "question": "What is rubric-based feedback?",
        "answer": "Rubric-based feedback explains how a draft meets or falls short of the stated assessment criteria. It helps you connect a comment to a requirement and decide what evidence or explanation to improve."
      },
      {
        "question": "What feedback is included in the free trial?",
        "answer": `The free trial includes ${FREE_TRIAL_LIMIT} evaluations with estimated scores and the leading improvement priority. Detailed criterion feedback, three improvement priorities, and Strict mode require credits or Pro. Rewrite suggestions require Pro.`
      },
      {
        "question": "Can I use feedback without accepting the estimated grade?",
        "answer": "Yes. You can assess each comment on its own merits and use the helpful revision suggestions even if you disagree with a score estimate. Compare the feedback with the rubric and your draft, and ask your instructor about unclear criteria."
      }
    ],
    "ctaLabel": "Get feedback on my draft",
    "path": "/rubric-feedback-tool",
    "relatedLinks": [
      {
        "href": "/essay-rubric-checker",
        "label": "Check your essay against a rubric",
        "description": "Review your thesis, evidence, analysis, and essay structure."
      },
      {
        "href": "/ai-rubric-grader",
        "label": "AI rubric grader",
        "description": "Understand estimated scores, grading modes, and their limits."
      },
      {
        "href": "/how-to-use-a-rubric-to-check-an-assignment",
        "label": "How to use a rubric",
        "description": "Follow a worked example to self-check an assignment."
      }
    ],
    "ctaHref": "/#rubric-checker"
  }
];

export function getSeoLandingPage(slug: SeoLandingPageContent["slug"]): SeoLandingPageContent {
  const page = SEO_LANDING_PAGES.find((item) => item.slug === slug);
  if (!page) throw new Error(`Unknown SEO landing page: ${slug}`);
  return page;
}
