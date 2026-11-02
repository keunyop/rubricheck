import Link from "next/link";
import { CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function RequirementsArticle() { return <>
        <p className={styles.lead}>To check assignment requirements, turn each instruction into something you can locate in your draft. Then use the rubric to judge the quality of that work. Finish by checking the file and submission details yourself.</p>
        <section aria-labelledby="requirements-method">
          <h2 id="requirements-method">Separate three kinds of checks</h2>
          <figure className={styles.figure}>
            <ol className={styles.steps}>
              <li><span>01</span><h3>Instructions</h3><p>What must you do or include?</p></li>
              <li><span>02</span><h3>Rubric</h3><p>How well must you do it?</p></li>
              <li><span>03</span><h3>Submission</h3><p>Which file, where, and when?</p></li>
            </ol>
            <figcaption>A complete checklist covers the task, the quality, and the hand-in.</figcaption>
          </figure>
          <p>A rubric describes how work is assessed. It may not repeat the word limit, required sources, or upload instructions. Keep both documents open; ask your instructor if they conflict.</p>
        </section>
        <section aria-labelledby="requirements-checklist">
          <h2 id="requirements-checklist">Your five-point assignment checklist</h2>
          <ol className={styles.checklist}>
            <li><strong>Answer the task.</strong> Underline the action word: compare, analyze, evaluate, or explain. Point to the passage that performs it.</li>
            <li><strong>Find every required part.</strong> Match each requested section, example, calculation, or reflection to a place in the draft.</li>
            <li><strong>Check evidence and citations.</strong> Verify the required source types and count. Open the original sources and check that citations match.</li>
            <li><strong>Apply the rubric.</strong> Read the performance descriptions, not only the criterion names. Choose one gap in a heavily weighted criterion to revise first.</li>
            <li><strong>Check the final file.</strong> Confirm length, file format, filename, submission location, and deadline against the course instructions. Open the exported file before uploading.</li>
          </ol>
        </section>
        <section aria-labelledby="requirements-example">
          <h2 id="requirements-example">Example: turn an instruction into proof</h2>
          <p className={styles.note}>Invented assignment brief: “Write an 800–1,000-word report comparing two approaches. Use three course readings, discuss one limitation, and submit a PDF.”</p>
          <div className={styles.tableWrap}><table>
            <caption>Check what is present before judging how well it is done</caption>
            <thead><tr><th scope="col">Requirement</th><th scope="col">Evidence to find</th></tr></thead>
            <tbody><tr><th scope="row">Compare two approaches</th><td>A direct comparison using the same criteria, not two unrelated summaries.</td></tr><tr><th scope="row">Use three readings</th><td>Three course sources used in the report, with matching citations and references.</td></tr><tr><th scope="row">Discuss a limitation</th><td>A specific constraint and its effect on the conclusion.</td></tr><tr><th scope="row">Length and PDF</th><td>The final word count and an exported PDF that opens correctly.</td></tr></tbody>
          </table></div>
          <p>If your draft describes both approaches but never compares them, the next edit is a comparison paragraph. Polishing grammar will not fill that gap.</p>
        </section>
        <section aria-labelledby="requirements-ai">
          <h2 id="requirements-ai">Can an AI assignment requirements checker help?</h2>
          <p>It can offer a second review of your draft against the criteria you provide. Verify its suggestions yourself: a plausible comment can still miss a requirement or misread your writing.</p>
          <p>In RubriCheck, use your own rubric when available. Without one, choose general criteria and add the assignment instructions. General feedback does not reproduce your instructor’s grading scheme.</p>
          <p>Check submission settings, source accuracy, and course rules yourself. For a deeper quality review, see <Link href="/how-to-use-a-rubric-to-check-an-assignment">how to check an assignment against a rubric</Link>.</p>
        </section>
        <aside className={styles.cta} aria-labelledby="requirements-cta">
          <p className={styles.eyebrow}>TRY IT ON YOUR ASSIGNMENT</p>
          <h2 id="requirements-cta">Find your next revision before you submit.</h2>
          <p>Start with general criteria and add your instructions, or switch to your own rubric for a criterion-based review.</p>
          <Link href="/workspace?start=general&from=blog-requirements#rubric-checker" className={styles.button}>Check my assignment →</Link>
          <p className={styles.note}>One free summary preview without signing up. AI feedback is guidance; your instructor determines the grade. Follow your course’s AI policy.</p>
        </aside>
        <section className={styles.sources} aria-labelledby="requirements-sources">
          <h2 id="requirements-sources">Further reading</h2>
          <ul><li><a href="https://writingcenter.unc.edu/tips-and-tools/understanding-assignments/">UNC Writing Center: understanding assignments</a></li><li><a href="https://www.cmu.edu/teaching/assessment/assesslearning/rubrics.html">Carnegie Mellon University: what rubrics assess</a></li></ul>
          <p>More about the tool: <Link href="/assignment-rubric-checker">assignment rubric checker</Link>.</p>
        </section>
        <p>Next: <Link href={CRITICAL_ANALYSIS_POST.path}>make a descriptive essay more analytical</Link> with a worked paragraph.</p>
  </>;
}
