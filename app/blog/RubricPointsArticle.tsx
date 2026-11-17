import Link from "next/link";
import { BLOG_POST, RUBRIC_FEEDBACK_REVISION_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function RubricPointsArticle() {
  return <>
    <p className={styles.lead}>Before you use a rubric to review a draft, check what its numbers mean. A row maximum, a performance level, a percentage weight and an overall point total are different things. If they disagree, a score can look precise while answering the wrong question.</p>
    <p>Keep your instructor&apos;s original rubric and assignment instructions beside you. This guide helps you find a question to clarify; it cannot decide how an ambiguous rubric should be graded.</p>

    <section aria-labelledby="points-example">
      <h2 id="points-example">1. Add the row maximums in a points rubric</h2>
      <p>Suppose a fictional short report has three criteria. The rubric gives the highest available score for each row: claim, 4 points; evidence, 6 points; explanation, 10 points. The maximum is 20 points. Those are row maximums, not scores earned by the student.</p>
      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="Illustrative rubric row maximums and total">
          <li><strong>Claim</strong><span>Up to 4 points</span></li>
          <li><strong>Evidence</strong><span>Up to 6 points</span></li>
          <li><strong>Explanation</strong><span>Up to 10 points</span></li>
          <li><strong>Total</strong><span>4 + 6 + 10 = 20 points</span></li>
        </ol>
        <figcaption>Illustrative points rubric. Read each row&apos;s maximum and compare their sum with the stated overall maximum.</figcaption>
      </figure>
      <p>If the heading instead says “25 points,” stop and check for a missing criterion, a separately scored requirement, or a transcription error. Do not silently change 25 to 20 or inflate a row to make the arithmetic fit. Ask the instructor or rubric owner which total applies.</p>
    </section>

    <section aria-labelledby="weights-example">
      <h2 id="weights-example">2. Keep percentage weights separate from points</h2>
      <p>A different rubric might weight claim at 20%, evidence at 30% and explanation at 50%. Those percentages add to 100%, but they are not automatically 20, 30 and 50 points. A row might describe four levels of performance without assigning any points at all.</p>
      <p>In the fictional example, 4/20, 6/20 and 10/20 happen to equal 20%, 30% and 50%. That coincidence does not define the scoring rule for every rubric. If a rubric uses both points and weights, find its explicit conversion rule or ask how the final mark is calculated.</p>
      <p><a href="https://www.cmu.edu/teaching/designteach/teach/rubrics.html">Carnegie Mellon University&apos;s rubric guide</a> describes criteria and performance descriptions as separate parts of a rubric. Read the description that applies to your work as well as the numbers; a calculation alone does not explain the quality standard.</p>
    </section>

    <section aria-labelledby="points-checklist">
      <h2 id="points-checklist">3. Check the rubric before reviewing your draft</h2>
      <ol className={styles.checklist}>
        <li><strong>Find every scored row.</strong> Include rows on another page or in an appendix. Check whether a title or subtotal repeats a row rather than adding a new one.</li>
        <li><strong>Label each number.</strong> Is it a row maximum, a level label, an earned score, a percentage weight, or the overall maximum?</li>
        <li><strong>Compare totals.</strong> Add only comparable row maximums. If the total differs, note the exact rows and ask for clarification.</li>
        <li><strong>Read the descriptors.</strong> Check what evidence each criterion asks for; do not assume a higher number always means more words.</li>
      </ol>
      <p>If your rubric is a grid of performance levels, preserve the row headings, level descriptions and any point values when copying it. A screenshot or PDF may be clearer than pasted text if the columns would otherwise lose their alignment. Remove personal information you do not need to share.</p>
      <p>For a final check of the assignment itself, use the <Link href={BLOG_POST.path}>assignment requirements checklist</Link>. Once you have feedback on a draft, the <Link href={RUBRIC_FEEDBACK_REVISION_POST.path}>revision plan example</Link> shows how to turn one criterion comment into a concrete edit.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="points-cta">
      <p className={styles.eyebrow}>CHECK THE CRITERIA FIRST</p>
      <h2 id="points-cta">Review your draft with the complete rubric</h2>
      <p>Add your draft and the rubric to RubriCheck after resolving unclear totals or weights. The tool can help organize a review, but its score is an estimate and cannot settle an instructor&apos;s ambiguous marking scheme. Check the current plan details before choosing paid feedback.</p>
      <Link href="/workspace?from=blog-rubric-points#rubric-checker" className={styles.button}>Check my draft with a rubric →</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="points-source">
      <h2 id="points-source">Rubric guidance</h2>
      <ul><li><a href="https://www.cmu.edu/teaching/designteach/teach/rubrics.html">Carnegie Mellon University: Creating and Using Rubrics</a></li></ul>
      <p>The report, criteria and numbers above are fictional. The university guide informs the distinction between criteria and descriptions; it does not endorse RubriCheck or validate this example.</p>
    </section>
  </>;
}
