import Link from "next/link";
import { BLOG_POST, CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function CompareDraftsArticle() {
  return <>
    <p className={styles.lead}>To compare two essay drafts, keep the assignment instructions and rubric the same, then check what changed under each criterion. Record the passage you revised, the evidence it now provides, and anything still missing. If you use an AI checker, keep the grading mode the same too. A changed score is a reason to inspect the work, not proof that the revision improved it.</p>
    <p>This guide is for a draft you have already reviewed once. You can use the process manually or alongside AI feedback. Your instructor&apos;s rubric and course rules remain the reference for your final submission.</p>

    <section aria-labelledby="compare-save"><h2 id="compare-save">1. Save the first draft and its review conditions</h2>
      <p>Before making another edit, keep a copy of the earlier draft and the feedback you are responding to. Give each file a clear version name. Write down:</p>
      <ul className={styles.bulletList}>
        <li>The assignment question and any relevant instructions.</li>
        <li>The complete rubric, including points and performance descriptions.</li>
        <li>The part of the essay you plan to revise.</li>
        <li>The grading mode, if you used an AI review tool.</li>
      </ul>
      <p>Changing the rubric, switching between general criteria and your instructor&apos;s criteria, or changing the review mode creates a different comparison. It may still be useful, but you cannot attribute the whole score difference to your writing.</p>
      <p><a href="https://www.cmu.edu/teaching/designteach/teach/rubrics.html">Carnegie Mellon&apos;s guide to rubrics</a> explains how rubrics connect parts of an assignment with descriptions of expected performance. For your comparison, read those descriptions alongside both drafts. A criterion name such as “analysis” is too broad to tell you what changed.</p>
    </section>

    <section aria-labelledby="compare-edit"><h2 id="compare-edit">2. Turn one feedback comment into a testable edit</h2>
      <p>“Improve the evidence” is a starting point. A more useful revision task says where the problem is and what the reader needs to see.</p>
      <p>For example: “In paragraph two, replace the claim about all students with the actual survey finding, then explain what that small sample cannot establish.” You can check whether the next draft does this without waiting for a new score.</p>
      <p>Revision can involve changing ideas or organization, not only fixing sentences. <a href="https://writing-center.mtsu.edu/com10revision/">MTSU&apos;s revision guidance</a> describes reviewing content and structure and suggests outlining an existing draft when its organization is unclear. If an essay&apos;s main claim does not answer the task, editing that claim may matter more than polishing every sentence first.</p>
    </section>

    <section aria-labelledby="compare-example"><h2 id="compare-example">3. Worked example: compare the evidence in two versions</h2>
      <p className={styles.note}>Everything in this exercise is fictional: the assignment, survey, rubric and paragraphs. The example is not a student submission, a real campus study or a RubriCheck evaluation.</p>
      <p><strong>Practice task:</strong> Recommend whether a campus library should extend its closing time from 8 p.m. to 10 p.m. Explain the evidence and a limitation.</p>
      <p><strong>Material available to the writer:</strong> A survey of 24 students at one afternoon event found that 15 wanted later opening and 9 did not. The material gives no information about staffing costs or whether respondents would actually visit after 8 p.m.</p>
      <p><strong>Practice rubric:</strong> Support the recommendation with the supplied evidence; explain how that evidence supports the decision; identify a limit that affects the conclusion. These are illustrative descriptors, not a university marking scheme.</p>
      <h3>Version 1: a claim that goes beyond the evidence</h3>
      <blockquote className={styles.example}><p>The library should close at 10 p.m. because all students need longer study hours. The survey proves that extending opening hours will solve the problem, so the change should happen immediately.</p></blockquote>
      <p>The paragraph gives a recommendation, but “all students” exceeds the survey&apos;s scope. It also treats a preference as proof of an outcome. Neither a cost estimate nor evidence that the change would solve the problem is available.</p>
      <h3>Version 2: a narrower conclusion with an explicit limit</h3>
      <blockquote className={styles.example}><p>The survey provides a reason to investigate later opening: 15 of the 24 respondents wanted it. However, one afternoon event does not represent every student&apos;s schedule, and a stated preference does not show how many people would visit after 8 p.m. A limited trial, with attendance and staffing costs recorded, would provide more relevant evidence before committing to a permanent change.</p></blockquote>
      <p>The revision now uses the supplied finding, explains its scope and proposes a way to investigate what remains unknown. It has not established that later opening is affordable or necessary. Those questions remain open.</p>
      <h3>Compare by criterion, not by paragraph length</h3>
      <p><strong>Evidence:</strong> Version 1 claims universal need. Version 2 reports the actual 15-of-24 finding. The improvement to check is accuracy and scope, not simply the addition of a number.</p>
      <p><strong>Reasoning:</strong> Version 1 jumps from preference to a guaranteed solution. Version 2 separates an indication of interest from evidence of actual use. The recommendation is more limited because the evidence is limited.</p>
      <p><strong>Limitation:</strong> Version 1 gives none. Version 2 identifies sampling, actual attendance and costs as unresolved. A real assignment may require a different decision or more sources; follow its instructions.</p>
      <p>If your own problem is a paragraph that summarizes sources without explaining them, use the separate <Link href={CRITICAL_ANALYSIS_POST.path}>critical analysis revision exercise</Link>.</p>
    </section>

    <section className={styles.practice} aria-labelledby="compare-log"><h2 id="compare-log">4. Keep a short revision log</h2>
      <p>Copy this four-line record for each important change. Fill it in with locations in your own draft rather than a general statement such as “made the essay better.”</p>
      <ul className={styles.bulletList}>
        <li><strong>Criterion:</strong> Evidence supports the recommendation.</li>
        <li><strong>Earlier gap:</strong> Paragraph two said “all students,” but the supplied survey covered only 24 respondents.</li>
        <li><strong>Edit made:</strong> Replaced the universal claim with the observed count and explained the sample&apos;s limit.</li>
        <li><strong>Still to check:</strong> Does the conclusion elsewhere in the essay make the same unsupported claim?</li>
      </ul>
      <p>That last question matters. A careful body paragraph can still conflict with an exaggerated conclusion. After a local edit, reread the introduction, topic sentences and conclusion for consistency. Use the <Link href={BLOG_POST.path}>assignment requirements checklist</Link> for the final whole-file review.</p>
    </section>

    <section aria-labelledby="compare-score"><h2 id="compare-score">5. Read a changed AI score alongside the drafts</h2>
      <p>Suppose an AI review displays <strong>68–74</strong> for one draft and <strong>70–76</strong> for the next. These numbers are invented for this explanation. The displayed endpoints moved by two points; that alone does not establish a two-point improvement or predict your instructor&apos;s grade.</p>
      <p>RubriCheck&apos;s displayed ranges are AI estimates, not statistically calibrated confidence intervals. You cannot use the amount of overlap as a statistical test of whether your revision worked. AI estimates can still vary when you keep the rubric and mode the same.</p>
      <p>Instead, return to your revision log. Does the newer feedback recognize the actual evidence you added? Does it point to a gap you can locate? Check a claim that seems wrong against the relevant passage and rubric descriptor before acting on it.</p>
      <p>If a score changes unexpectedly, first confirm that both checks used the intended draft, complete rubric, same mode and readable files. An older saved result may also use an earlier scoring method; read any calculation notice attached to it before comparing totals. Repeatedly submitting an unchanged draft until a preferred number appears does not demonstrate a revision.</p>
    </section>

    <section aria-labelledby="compare-next"><h2 id="compare-next">6. Use the next check to answer a specific question</h2>
      <p>In RubriCheck, signed-in users can organize saved evaluations in projects and open their versions. Use <strong>New version</strong> for a revised draft, then confirm the rubric and grading mode before evaluating. Open each saved result and compare its comments with the corresponding text and your revision log.</p>
      <p>If you reviewed the first draft with general criteria, keep that basis for the comparison or clearly note when you switch to an instructor rubric. General criteria are useful for a broad review; they do not reproduce an instructor&apos;s marking scheme.</p>
      <p>Choose a question such as “Does paragraph two now justify the recommendation using the supplied evidence?” Check the answer against the draft yourself. Re-evaluation uses the access and limits of your current plan; it is not a promise of unlimited free checks or a higher grade.</p>
      <p>For more about applying comments, see the <Link href="/rubric-feedback-tool">rubric feedback guide</Link>. If you are starting your first review, the <Link href="/essay-rubric-checker">essay rubric checker</Link> explains how to provide your essay and criteria.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="compare-cta"><p className={styles.eyebrow}>REVIEW YOUR REVISION</p><h2 id="compare-cta">Check what changed under your rubric</h2>
      <p>Bring your revised draft and the same rubric to RubriCheck. Read the feedback beside your own revision log, then decide what to edit next. AI feedback is an estimate; your instructor&apos;s criteria and course rules take priority.</p>
      <Link href="/workspace#rubric-checker" className={styles.button}>Review my revised draft →</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="compare-sources"><h2 id="compare-sources">Sources and example notes</h2>
      <p>Source pages checked on 10 November 2026:</p>
      <ul>
        <li><a href="https://www.cmu.edu/teaching/designteach/teach/rubrics.html">Carnegie Mellon University: Grading and Performance Rubrics</a> — criteria, performance descriptions and feedback.</li>
        <li><a href="https://writing-center.mtsu.edu/com10revision/">Middle Tennessee State University Writing Center: Revision Strategies</a> — reviewing ideas, organization and wording during revision.</li>
      </ul>
      <p>The library scenario, both paragraphs, practice descriptors, revision log and score ranges were created for this guide. The university pages provide general guidance; they do not validate the fictional example, endorse RubriCheck or establish its grading accuracy.</p>
    </section>
  </>;
}
