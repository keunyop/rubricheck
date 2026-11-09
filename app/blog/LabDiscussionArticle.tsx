import Link from "next/link";
import { BLOG_POST, CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function LabDiscussionArticle() {
  return <>
    <p className={styles.lead}>A lab report discussion should <strong>answer the experimental question, interpret a key result, compare it with the relevant expectation, and explain what limits the conclusion</strong>. Use your measurements as evidence. Replace “human error” with a specific possible source of uncertainty and explain its effect without pretending you proved the cause.</p>
    <p>This guide is for introductory university science and engineering reports. Your lab manual and marking rubric take priority: some courses combine Results and Discussion, require particular calculations, or ask for separate answers to lab questions.</p>
    <section aria-labelledby="lab-results-discussion"><h2 id="lab-results-discussion">Results and Discussion do different jobs</h2>
      <figure className={styles.figure}>
        <ol className={styles.steps}>
          <li><span>01</span><strong>Report</strong><p>What did you measure? State the finding and point to the table or figure.</p></li>
          <li><span>02</span><strong>Interpret</strong><p>What does it suggest about the aim, hypothesis or expected value?</p></li>
          <li><span>03</span><strong>Qualify</strong><p>What cannot be established, and which check would reduce that uncertainty?</p></li>
        </ol>
        <figcaption>A writing sequence, not a universal section order or marking scheme.</figcaption>
      </figure>
      <div className={styles.tableWrap}><table>
        <caption>Choose the sentence that does the required job</caption>
        <thead><tr><th scope="col">Section</th><th scope="col">Sentence purpose</th></tr></thead>
        <tbody>
          <tr><th scope="row">Results</th><td>“The mean recorded volume was 48.2 mL (Table 1).” Reports the observation.</td></tr>
          <tr><th scope="row">Discussion</th><td>“The mean was below the 50.0 mL target, but these readings alone cannot distinguish under-delivery from measurement bias.” Interprets and limits the claim.</td></tr>
        </tbody>
      </table></div>
      <p>The <a href="https://guides.lib.uoguelph.ca/c.php?g=130963&amp;p=4437733">University of Guelph guide</a> distinguishes presenting observations from explaining what they mean. You may recall a key number in the discussion; repeating the entire results table adds little.</p>
    </section>
    <section aria-labelledby="lab-worked-example"><h2 id="lab-worked-example">Worked example: a result below the target</h2>
      <p className={styles.note}>Invented practice scenario. A student checks a dispenser set to deliver 50.0 mL. The table, target and notebook note below are fictional; they are not a real experiment, instrument specification or course rubric. Decimal places are for this writing exercise, not a claim about instrument accuracy.</p>
      <div className={styles.tableWrap}><table>
        <caption>Table 1. Fictional recorded volumes at the same dispenser setting</caption>
        <thead><tr><th scope="col">Trial</th><th scope="col">Recorded volume</th><th scope="col">Target</th></tr></thead>
        <tbody>{[["1", "48.1"], ["2", "48.3"], ["3", "48.2"]].map(([trial, volume]) => <tr key={trial}><th scope="row">{trial}</th><td>{volume} mL</td><td>50.0 mL</td></tr>)}</tbody>
      </table></div>
      <p><strong>Check the arithmetic:</strong> (48.1 + 48.3 + 48.2) ÷ 3 = 48.2 mL. The mean is 1.8 mL below the target. The notebook records that the same measuring cylinder was used each time; it contains no calibration check or uncertainty estimate.</p>
      <h3>Weak draft: a number followed by a guess</h3>
      <blockquote className={styles.example}><p>The result was 48.2 mL instead of 50.0 mL. This was due to human error. We should be more careful next time.</p></blockquote>
      <p>“Due to” claims a cause without evidence. “More careful” does not tell the next investigator what to change.</p>
      <h3>Revision: result → interpretation → limitation → useful next check</h3>
      <blockquote className={styles.example}><p>The dispenser check produced a mean recorded volume of 48.2 mL, 1.8 mL below the 50.0 mL target (Table 1). All three readings were below the target, so the recorded results consistently indicate a shortfall under these test conditions. However, using the same measuring cylinder for every trial leaves a possible measurement bias unresolved. The close readings show a small spread in this set; they do not establish accuracy. Without a calibration check and an uncertainty estimate, the discrepancy cannot be assigned confidently to the dispenser itself. Repeating the check with an independently verified measuring method would help distinguish a delivery problem from a measurement problem.</p></blockquote>
      <p>This paragraph does not invent a defective instrument or claim statistical significance. In a real report, add the uncertainty analysis your course requires and cite the actual source of an expected value or theoretical relationship. Never invent a reference to make the comparison look stronger.</p>
    </section>
    <section aria-labelledby="lab-limits"><h2 id="lab-limits">Make each limitation explain something</h2>
      <div className={styles.tableWrap}><table>
        <caption>Replace vague explanations with testable ones</caption>
        <thead><tr><th scope="col">Weak wording</th><th scope="col">Better revision question</th></tr></thead>
        <tbody>
          <tr><th scope="row">“Human error”</th><td>Which recorded step could affect the measurement? Is its direction known, or only possible?</td></tr>
          <tr><th scope="row">“Only three trials”</th><td>What does this small set leave uncertain? Would repeats address variation, or would a different check be needed for bias?</td></tr>
          <tr><th scope="row">“The experiment failed”</th><td>Which observation conflicts with the expectation? Can the data still answer part of the original question?</td></tr>
        </tbody>
      </table></div>
      <p>The <a href="https://ecp.engineering.utoronto.ca/resources/online-handbook/types-of-documents/lab-reports/">University of Toronto engineering guide</a> recommends specific accounts of discrepancies and experimental limitations. If a cause was not tested, write “could have contributed” and explain why it is plausible. Do not silently change or remove an unexpected result to fit the expected pattern.</p>
    </section>
    <section className={styles.practice} aria-labelledby="lab-exercise"><h2 id="lab-exercise">Try a 60-second revision</h2>
      <p>Revise: “The three readings were close together, proving the dispenser is accurate.” What can these readings establish, and what check is missing?</p>
      <details><summary>Show a possible revision</summary><p><strong>The three readings have a small spread in this set, but accuracy remains unresolved.</strong> They are all below the target, and the measuring method has not been independently checked. A small spread does not rule out a shared bias.</p></details>
    </section>
    <section aria-labelledby="lab-rubric"><h2 id="lab-rubric">Check your discussion against the actual rubric</h2>
      <p>Use these as revision prompts, then replace them with your course’s exact criteria. They are not a marking rubric from a university.</p>
      <ol className={styles.checklist}>
        <li><strong>Aim:</strong> underline the sentence answering the experimental question.</li>
        <li><strong>Evidence:</strong> circle each key claim and locate its measurement, table or figure.</li>
        <li><strong>Comparison:</strong> identify the real source of the expectation and explain any difference.</li>
        <li><strong>Limitation:</strong> name a specific uncertainty and state which conclusion it restricts.</li>
        <li><strong>Improvement:</strong> propose a check that addresses that limitation, not just more repetitions of the same procedure.</li>
      </ol>
      <p>For the file, word limit and other submission details, use the <Link href={BLOG_POST.path}>assignment requirements checklist</Link>. For an essay rather than a laboratory report, see <Link href={CRITICAL_ANALYSIS_POST.path}>how to move from description to critical analysis</Link>.</p>
    </section>
    <aside className={styles.cta} aria-labelledby="lab-check"><p className={styles.eyebrow}>REVIEW YOUR OWN DRAFT</p><h2 id="lab-check">Find missing explanations before submission</h2>
      <p>Open RubriCheck, choose your own rubric when available, and add the report draft and assignment instructions. Review the feedback criterion by criterion and verify every suggestion against your lab notebook and sources. If you use general criteria, they do not reproduce your instructor’s marking scheme.</p>
      <p>RubriCheck can review the writing against the criteria you provide. It cannot verify the experiment, calibrate equipment, authenticate raw data or guarantee a mark. Follow your course’s rules on AI assistance.</p>
      <Link href="/workspace?start=general&amp;from=blog-lab-discussion#rubric-checker" className={styles.button}>Check my lab report draft →</Link>
    </aside>
    <section className={styles.sources} aria-labelledby="lab-sources"><h2 id="lab-sources">University guidance</h2>
      <ul>
        <li><a href="https://guides.lib.uoguelph.ca/c.php?g=130963&amp;p=4437733">University of Guelph: parts of lab or research reports</a></li>
        <li><a href="https://ecp.engineering.utoronto.ca/resources/online-handbook/types-of-documents/lab-reports/">University of Toronto: lab reports</a></li>
        <li><a href="https://www.monash.edu/student-academic-success/excel-at-writing/annotated-assessment-samples/science/science-lab-report">Monash University: annotated science lab report guidance</a></li>
      </ul>
      <p>Checked 8 November 2026. These guides inform the writing advice; the dispenser example and revision exercise were created for this article. Monash also stresses checking the unit’s own instructions and rubric, because requirements vary.</p>
    </section>
  </>;
}
