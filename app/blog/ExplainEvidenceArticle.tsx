import Link from "next/link";
import { BLOG_POST, CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function ExplainEvidenceArticle() {
  return <>
    <p className={styles.lead}>To explain evidence in an essay paragraph, tell the reader what a specific source shows, how it supports your point, and what it cannot establish. A quotation or number does not do that work by itself. The example below turns a dropped-in observation into a reasoned, limited claim.</p>
    <p>Use your assignment question, course sources, citation rules, and marking rubric as the guide. Some disciplines use different paragraph structures. This is a practice method for checking your reasoning, not a fixed formula your instructor must accept.</p>

    <figure className={styles.evidenceFlow}>
      <ol className={styles.evidenceFlowList} aria-label="Four steps for explaining evidence">
        <li><strong>Claim</strong><span>What am I arguing?</span></li>
        <li><strong>Evidence</strong><span>What does the source show?</span></li>
        <li><strong>Inference</strong><span>Why does that detail matter?</span></li>
        <li><strong>Limit</strong><span>What can it not prove?</span></li>
      </ol>
      <figcaption>Read the path in order: make a claim, give a specific source detail, explain the inference, then name the limit. Return to your assignment question when you write the paragraph.</figcaption>
    </figure>

    <section aria-labelledby="evidence-job">
      <h2 id="evidence-job">Give each piece of evidence a job</h2>
      <p>Start with one claim the paragraph needs to support. Then choose evidence that can actually help test that claim. A source may show a pattern, give a concrete example, define a term, or challenge an assumption. Ask what the reader would be unable to understand if you removed it.</p>
      <p>The <a href="https://writingcenter.fas.harvard.edu/anatomy-body-paragraph">Harvard College Writing Center&apos;s guide to body paragraphs</a> shows how a topic sentence creates an expectation that the following evidence and discussion should meet. The <a href="https://uwaterloo.ca/writing-and-communication-centre/building-strong-body-paragraphs">University of Waterloo&apos;s body paragraph guide</a> separates claim, evidence, and analysis in a sample paragraph. These are useful checks even when your course does not require one named paragraph formula.</p>
      <ol className={styles.checklist}>
        <li><strong>Claim:</strong> What precise point are you asking the reader to accept?</li>
        <li><strong>Evidence:</strong> Which source detail bears on that point, and where did it come from?</li>
        <li><strong>Explanation:</strong> What can you infer from the detail, and what is still unknown?</li>
        <li><strong>Connection:</strong> How does that limited conclusion advance the assignment question?</li>
      </ol>
    </section>

    <section aria-labelledby="evidence-example">
      <h2 id="evidence-example">Example: explain an observation rather than repeat it</h2>
      <p className={styles.note}>Invented practice exercise. The task, observation notes, rubric, and paragraphs below are fictional teaching materials. They are not a real campus study, student submission, or RubriCheck result. Do not cite the numbers as factual evidence.</p>
      <p><strong>Practice task:</strong> Recommend whether a campus should trial a booking system for quiet study rooms. Use the supplied observation and explain one limitation.</p>
      <p><strong>Fictional observation:</strong> On two Tuesday evenings, 12 of 16 quiet study rooms were occupied at 7 p.m. The notes do not record how long people stayed, whether other rooms were free, or what happened on other days.</p>
      <p><strong>Practice rubric:</strong> Make a relevant recommendation, use the supplied observation accurately, explain its relevance, and acknowledge a limit. These are illustrative criteria, not a university grading scheme.</p>
      <h3>Evidence dropped into a paragraph</h3>
      <blockquote className={styles.example}><p>“The campus needs a booking system. Twelve of 16 rooms were occupied at 7 p.m. This proves students cannot find anywhere to study, so the campus should require everyone to book.”</p></blockquote>
      <p>The count is relevant, but the paragraph skips the reasoning. Occupied rooms at one time do not show whether students were turned away. The final sentence also turns a possible trial into a permanent rule without evidence about demand on other days.</p>
      <h3>Evidence explained and qualified</h3>
      <blockquote className={styles.example}><p>“The campus should test whether evening room booking helps students find available quiet space. In the supplied observation, 12 of 16 quiet study rooms were occupied at 7 p.m. on two Tuesday evenings. That count suggests limited spare capacity at those times, so a small trial could show whether displaying availability is useful. It does not show that students were turned away or that the same pattern holds on other days. Before making booking mandatory, the campus should record requests, available rooms, and use across several days.”</p></blockquote>
      <p>The revised paragraph identifies the evidence&apos;s narrow scope, draws a proportionate inference, and names what a later decision would need. It does not claim that a booking system would definitely solve a problem.</p>
      <ul className={styles.bulletList}>
        <li><strong>Point:</strong> Test a booking system rather than impose one permanently.</li>
        <li><strong>Evidence:</strong> The exact count and observation times are included.</li>
        <li><strong>Explanation:</strong> Occupancy suggests limited spare capacity at those times.</li>
        <li><strong>Limit:</strong> The notes cannot establish unmet demand or a campus-wide pattern.</li>
        <li><strong>Link:</strong> A trial and better records would inform the recommendation.</li>
      </ul>
    </section>

    <section aria-labelledby="evidence-revision">
      <h2 id="evidence-revision">Revise your own paragraph in three passes</h2>
      <ol className={styles.checklist}>
        <li><strong>Mark the source detail.</strong> Underline the quotation, paraphrase, data point, or observation. Check it against the original source and cite it in your course&apos;s required style.</li>
        <li><strong>Mark the inference.</strong> Circle the sentence that explains why this detail matters for your claim. If that sentence only repeats the evidence, write what the detail permits you to conclude.</li>
        <li><strong>Mark the boundary.</strong> Identify a claim your source cannot support. Narrow the wording or find more evidence before making it.</li>
      </ol>
      <p>The <a href="https://students.unimelb.edu.au/academic-skills/reading-writing-and-referencing/writing-effectively/using-sources-checklist">University of Melbourne&apos;s source-use checklist</a> recommends making clear how source material contributes to your argument. If your paragraph mainly reports what a source says, the separate <Link href={CRITICAL_ANALYSIS_POST.path}>critical analysis example</Link> shows how to move from description to judgment.</p>
      <p>Do not add a sentence such as “This proves my point” as a substitute for reasoning. State the relationship: what part of the claim the source supports, why, and under which conditions. If a source challenges your claim, explain that tension rather than hiding it.</p>
    </section>

    <section className={styles.practice} aria-labelledby="evidence-checklist">
      <h2 id="evidence-checklist">Check the finished paragraph against your rubric</h2>
      <p>Read the descriptors your instructor supplied. “Evidence” may mean source quality, citation, interpretation, or several separate criteria in your course. Use these questions to locate the relevant work in your draft:</p>
      <ol className={styles.checklist}>
        <li>Does the paragraph&apos;s claim answer part of the assignment question?</li>
        <li>Can a reader tell which source supports each factual claim?</li>
        <li>Have you explained how the evidence supports the claim, in your own words?</li>
        <li>Have you avoided a conclusion broader than the evidence allows?</li>
        <li>Does the paragraph lead back to your larger argument?</li>
      </ol>
      <p>For a whole-draft check before submission, use the <Link href={BLOG_POST.path}>assignment requirements checklist</Link>.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="evidence-cta">
      <p className={styles.eyebrow}>REVIEW YOUR DRAFT</p>
      <h2 id="evidence-cta">Find the evidence your rubric asks for</h2>
      <p>Bring your own draft and a course rubric you are permitted to share to RubriCheck. Check whether the feedback points to a specific claim, source, or missing explanation, then verify it against your text and original sources.</p>
      <p>Without your rubric, general writing criteria can support a broad review but cannot reproduce your instructor&apos;s grading scheme. AI feedback may miss context or misread evidence; follow your course&apos;s AI policy, remove unnecessary personal information, and check citations yourself. An estimated score cannot guarantee a grade.</p>
      <Link href="/workspace?from=blog-explain-evidence#rubric-checker" className={styles.button}>Check my essay draft →</Link>
      <p>No rubric? <Link href="/workspace?start=general&amp;from=blog-explain-evidence#rubric-checker">Review with general writing criteria</Link>.</p>
    </aside>

    <section className={styles.sources} aria-labelledby="evidence-sources">
      <h2 id="evidence-sources">Writing guidance</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/anatomy-body-paragraph">Harvard College Writing Center: Anatomy of a Body Paragraph</a></li>
        <li><a href="https://uwaterloo.ca/writing-and-communication-centre/building-strong-body-paragraphs">University of Waterloo: Building Strong Body Paragraphs</a></li>
        <li><a href="https://students.unimelb.edu.au/academic-skills/reading-writing-and-referencing/writing-effectively/using-sources-checklist">University of Melbourne: Using Sources Checklist</a></li>
      </ul>
      <p>Checked 14 November 2026. These guides inform the writing advice. The room-booking exercise, observation, and paragraphs were created for this article.</p>
    </section>
  </>;
}
