import Link from "next/link";
import { BLOG_POST, CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function ReflectiveWritingArticle() {
  return <>
    <p className={styles.lead}>In reflective writing, keep <strong>What?</strong> to the event you need to analyse, use <strong>So what?</strong> to explain why it matters with evidence or course ideas, and make <strong>Now what?</strong> a specific action you can observe. The three questions are a planning frame, not a universal marking scheme: your assignment brief and rubric decide what earns marks.</p>
    <p>This guide is for university students writing about a placement, practical task, group project or other first-hand experience. It uses a fictional group-presentation example so you can see the difference between recounting an event and learning from it without copying a personal story.</p>

    <section aria-labelledby="reflection-three-moves">
      <h2 id="reflection-three-moves">Give each question a different job</h2>
      <div className={styles.tableWrap}><table>
        <caption>A practical test for each part of a reflection</caption>
        <thead><tr><th scope="col">Question</th><th scope="col">Do this</th><th scope="col">Check it</th></tr></thead>
        <tbody>
          <tr><th scope="row">What?</th><td>Select the incident, your action and the result that the reader needs.</td><td>Could you remove a detail without weakening the later analysis?</td></tr>
          <tr><th scope="row">So what?</th><td>Interpret the consequence. Test your first explanation against feedback, another perspective or relevant course material.</td><td>Have you explained why the experience changed or confirmed your understanding?</td></tr>
          <tr><th scope="row">Now what?</th><td>Name what you will do, when you will do it and what evidence will show whether it helped.</td><td>Could someone observe the action, rather than only your intention?</td></tr>
        </tbody>
      </table></div>
      <p>These parts do not have to be equal in length. University of Reading guidance notes that reflective insight is usually more important than a long narrative, while the University of Sheffield advises checking the assignment instructions and marking criteria because expectations vary by discipline.</p>
    </section>

    <section aria-labelledby="reflection-example">
      <h2 id="reflection-example">Worked example: move beyond “I should communicate better”</h2>
      <p className={styles.note}>Invented practice scenario: two days before a group presentation, a student notices that one chart has no source. The student replaces it alone. Fictional tutor feedback says that references were inconsistent across the final slides. This is not a real student, course or assessment.</p>
      <h3>Draft: the event plus a vague intention</h3>
      <blockquote className={styles.example}><p>When I found an unsourced chart, I replaced it because nobody else had time. I felt stressed, but the presentation was submitted. Next time I will communicate better and start earlier.</p></blockquote>
      <p>The sequence is clear, but the learning is not. “Communicate better” does not say what failed, what the student understood differently or what will change.</p>

      <h3>Revision: event, interpretation and testable action</h3>
      <blockquote className={styles.example}><p><strong>What?</strong> During the final review, I found an unsourced chart and replaced it myself instead of asking the group to check every claim. <strong>So what?</strong> This solved one visible problem but left the checking process dependent on one person. The feedback about inconsistent references suggests that my last-minute fix treated a symptom, while my silence prevented the group from sharing responsibility for the evidence. <strong>Now what?</strong> In the next project, I will add a source owner and link beside every claim in our shared outline, then schedule a group evidence check 72 hours before submission. I will test the change by confirming that every slide claim has a matching source entry before the final rehearsal.</p></blockquote>
      <p>The revision does not claim that the new process is guaranteed to work. It identifies an interpretation, connects it to the available feedback and defines evidence for checking the next attempt. If your rubric requires theory, add an appropriate course concept and cite the original source; do not insert a famous model only to decorate the paragraph.</p>
    </section>

    <section aria-labelledby="reflection-rubric">
      <h2 id="reflection-rubric">Translate your rubric into revision questions</h2>
      <p>The rows below are illustrative, not a university rubric. Replace them with the exact criteria and performance descriptors supplied for your assignment.</p>
      <div className={styles.tableWrap}><table>
        <caption>From a broad reflection criterion to visible evidence in the draft</caption>
        <thead><tr><th scope="col">Possible criterion</th><th scope="col">Evidence to locate</th><th scope="col">Revision question</th></tr></thead>
        <tbody>
          <tr><th scope="row">Specific experience</th><td>A focused incident and your own relevant action.</td><td>Is there enough context for the analysis without retelling the whole project?</td></tr>
          <tr><th scope="row">Critical reflection</th><td>A consequence, alternative interpretation or limit on your first view.</td><td>Have you examined your decision rather than only naming a feeling?</td></tr>
          <tr><th scope="row">Theory or evidence</th><td>An accurate connection to feedback, literature or course concepts when required.</td><td>Does the evidence help explain the incident, and have you cited it correctly?</td></tr>
          <tr><th scope="row">Future action</th><td>A feasible action, timing and way to review the outcome.</td><td>Does the plan follow from the analysis, and can you tell whether it happened?</td></tr>
        </tbody>
      </table></div>
    </section>

    <section aria-labelledby="reflection-checklist">
      <h2 id="reflection-checklist">A ten-minute check for one paragraph</h2>
      <ol className={styles.checklist}>
        <li>Highlight the sentences that only report what happened. Keep the minimum needed for the reader to follow the issue.</li>
        <li>Underline the sentence that explains why your response mattered. If there is none, write one before polishing the wording.</li>
        <li>Compare that explanation with the feedback, perspective or course concept you are allowed and expected to use.</li>
        <li>Circle the future action. Add a time, trigger or method if it could apply to almost any situation.</li>
        <li>Read the actual rubric descriptor again. Check that the paragraph shows its required work rather than merely using words such as “reflect” or “improve”.</li>
      </ol>
    </section>

    <aside className={styles.cta} aria-labelledby="reflection-cta">
      <p className={styles.eyebrow}>CHECK THE DRAFT YOU ACTUALLY HAVE</p>
      <h2 id="reflection-cta">Review your reflection against its marking criteria</h2>
      <p>Add your draft, assignment instructions and rubric when you have one. Use the feedback to locate a next revision, then verify every suggestion against the original criteria and your course rules.</p>
      <Link href="/workspace?start=general&from=blog-reflective-writing#rubric-checker" className={styles.button}>Check my reflective draft →</Link>
      <p className={styles.note}>AI feedback is guidance, not an official grade. Remove confidential or identifying details, follow placement and university policies, and ask your tutor when a reflective criterion is unclear.</p>
    </aside>

    <section className={styles.sources} aria-labelledby="reflection-sources">
      <h2 id="reflection-sources">Further reading and related guides</h2>
      <ul>
        <li><a href="https://sheffield.ac.uk/study-skills/university/independent/reflect">University of Sheffield: how to reflect in an academic context</a></li>
        <li><a href="https://libguides.reading.ac.uk/reflective/writing">University of Reading: reflective writing, evidence and selecting content</a></li>
      </ul>
      <p>If the missing work is analysis of sources rather than reflection on experience, use the <Link href={CRITICAL_ANALYSIS_POST.path}>critical analysis revision exercise</Link>. Before submitting the whole file, work through the <Link href={BLOG_POST.path}>assignment requirements checklist</Link>. You can also learn how <Link href="/rubric-feedback-tool">rubric-based feedback becomes a concrete edit</Link>.</p>
    </section>
  </>;
}
