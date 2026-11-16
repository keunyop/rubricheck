import Link from "next/link";
import { COMPARE_DRAFTS_POST, EXPLAIN_EVIDENCE_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function RubricFeedbackRevisionArticle() {
  return <>
    <p className={styles.lead}>To turn rubric feedback into a revision plan, read the exact criterion, locate the passage the comment concerns, make one change you can see on the page, and check the new passage against the criterion again. “Improve your analysis” is too broad to edit. “Explain why the evidence supports this choice, and what it cannot establish” gives you a task.</p>
    <p>This guide is for a student who has a draft and either instructor comments or a rubric-based review. The assignment instructions and your instructor&apos;s rubric decide what the work needs. An AI comment can help you spot a question, but it can misunderstand the text.</p>

    <section aria-labelledby="feedback-criterion">
      <h2 id="feedback-criterion">1. Read the criterion before the comment</h2>
      <p>Find the full rubric row: the criterion name, its performance descriptions and any weight. A comment about “evidence” could mean a missing source, an inaccurate detail or an unexplained link between a source and your claim. The row tells you which kind of performance the assignment asks for.</p>
      <p><a href="https://www.cmu.edu/teaching/designteach/teach/rubrics.html">Carnegie Mellon&apos;s rubric guide</a> explains how criteria and performance descriptions communicate expectations. When a comment is vague, compare it with the relevant description rather than assuming that more words or another citation will solve it. If the instructions and rubric seem to conflict, ask your instructor which one governs the task.</p>
    </section>

    <section aria-labelledby="feedback-example">
      <h2 id="feedback-example">2. Worked example: turn one comment into a paragraph edit</h2>
      <p className={styles.note}>This is a fictional classroom exercise. The assignment, counts, rubric, comment and paragraphs below are invented to show a revision method. They are not campus research or actual RubriCheck output.</p>
      <p><strong>Practice task:</strong> Recommend whether a college should pilot an email guide or a noticeboard to help first-year students find study support. Compare the two options using the supplied observations and identify one limit of the evidence.</p>
      <p><strong>Supplied notes:</strong> In a small class exercise, 18 of 30 students clicked a sample email guide; 11 of 30 said they noticed a sample noticeboard. The measures are different. Neither note says whether students later used a support service.</p>
      <p><strong>Practice rubric description:</strong> “Compare both options, use the supplied observations accurately, and explain a limitation that affects the recommendation.”</p>
      <p><strong>Illustrative feedback:</strong> “The paragraph names both options but treats the counts as proof that one format works better. Explain what each observation measures and limit the recommendation.”</p>
      <h3>Starting paragraph</h3>
      <blockquote className={styles.example}><p>“The college should use email because 18 students clicked it and only 11 noticed the board. Email is therefore more effective at getting students into support services.”</p></blockquote>
      <p>The paragraph jumps from a click and a reported notice to actual service use. It also compares different measures as if they were the same outcome. The next edit is to distinguish those measures and make the recommendation conditional.</p>

      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="Four steps from a rubric comment to a checked edit">
          <li><strong>Criterion</strong><span>Compare both options and a limitation.</span></li>
          <li><strong>Passage</strong><span>“Email is therefore more effective.”</span></li>
          <li><strong>Edit</strong><span>Separate clicks from notices; narrow the claim.</span></li>
          <li><strong>Check</strong><span>Find both measures and the unresolved outcome.</span></li>
        </ol>
        <figcaption>Trace one comment to a sentence you can change, then reread that sentence against the rubric description. The example&apos;s counts are fictional.</figcaption>
      </figure>

      <h3>A revision that answers the comment</h3>
      <blockquote className={styles.example}><p>“The sample email drew 18 clicks among 30 students, while 11 of 30 reported noticing the sample noticeboard. Those observations suggest that each format reached some students, but a click and a reported notice are not comparable measures of later use. The college could pilot both formats and record whether students actually contact a support service before choosing one.”</p></blockquote>
      <p>The revision compares the supplied observations without claiming that either format increased service use. It also names the evidence needed for a stronger decision. Your assignment might require a firmer recommendation; follow its instructions and explain the uncertainty rather than copying this answer.</p>
      <p>If your own paragraph includes a quotation or statistic but does not explain its connection to the claim, use the <Link href={EXPLAIN_EVIDENCE_POST.path}>evidence explanation example</Link> before revising it.</p>
    </section>

    <section className={styles.practice} aria-labelledby="feedback-plan">
      <h2 id="feedback-plan">3. Write a revision task you can verify</h2>
      <p>Copy four short lines for one important comment. Fill them with locations and text from your draft. The <a href="https://writingprogram.wsu.edu/undergraduate-writing-center/writing-guides/revising-your-own-writing/">Washington State University Writing Center&apos;s revision guide</a> recommends using the assignment prompt and rubric to make a focused checklist.</p>
      <ol className={styles.checklist}>
        <li><strong>Criterion:</strong> Which exact rubric description applies?</li>
        <li><strong>Passage:</strong> Where does your draft attempt it? Quote a short phrase or note the paragraph.</li>
        <li><strong>Next edit:</strong> What will you add, remove, qualify or reorganize? Name a visible change.</li>
        <li><strong>Check:</strong> What must a reader be able to point to after the edit?</li>
      </ol>
      <p>For the exercise above: “In paragraph three, replace the claim about effectiveness with the two distinct observations, then state that service use is unknown.” The check is whether the paragraph contains both measures and avoids treating them as proof of later use.</p>
    </section>

    <section aria-labelledby="feedback-priority">
      <h2 id="feedback-priority">4. Choose what to fix first</h2>
      <p>Start with a missing assignment requirement or a major reasoning gap in a heavily weighted criterion. Then address local clarity and sentence edits. This is a planning rule, not a promise of a higher mark: weights and descriptors vary by course, and a small wording problem can sometimes block the reader from seeing an important idea.</p>
      <p>Check each proposed edit against the original passage. If feedback says a comparison is absent but you can point to one, ask whether its reasoning is hard to find or whether the comment misread your draft. Do not add unsupported facts to satisfy a comment. Keep a note of questions that only the instructor can settle.</p>
      <p>After editing, read the introduction and conclusion too. A qualified body paragraph can still conflict with an absolute thesis. If you have a saved earlier version, <Link href={COMPARE_DRAFTS_POST.path}>compare the two drafts against the same rubric</Link> to see what actually changed.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="feedback-cta">
      <p className={styles.eyebrow}>MAKE THE NEXT EDIT SPECIFIC</p>
      <h2 id="feedback-cta">Review your draft against your own rubric</h2>
      <p>Add your assignment draft and the complete rubric to RubriCheck. Use the summary and leading improvement priority to choose a passage to inspect. Detailed criterion feedback requires credits or Pro; check the current plan details before choosing it. Compare every suggestion with your text, course instructions and original sources.</p>
      <p>AI feedback and score ranges are estimates, not an instructor grade or a guarantee that an edit improved the work. Remove personal information you do not need to share and follow your course&apos;s AI rules.</p>
      <Link href="/workspace?from=blog-rubric-feedback-revision#rubric-checker" className={styles.button}>Check my draft with a rubric →</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="feedback-sources">
      <h2 id="feedback-sources">Writing guidance</h2>
      <ul>
        <li><a href="https://www.cmu.edu/teaching/designteach/teach/rubrics.html">Carnegie Mellon University: Creating and Using Rubrics</a></li>
        <li><a href="https://writingprogram.wsu.edu/undergraduate-writing-center/writing-guides/revising-your-own-writing/">Washington State University Writing Center: Revising Your Own Writing</a></li>
      </ul>
      <p>Links checked 16 November 2026. The fictional exercise and feedback were created for this article. The university guides inform the writing method; they do not endorse RubriCheck or assess its output.</p>
    </section>
  </>;
}
