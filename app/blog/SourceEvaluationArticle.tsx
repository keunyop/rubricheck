import Link from "next/link";
import { EXPLAIN_EVIDENCE_POST, SYNTHESIS_PARAGRAPH_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function SourceEvaluationArticle() {
  return <>
    <p className={styles.lead}>To evaluate a source, decide whether its evidence is credible and suitable for the claim you want to make. Identify who produced it, trace important claims to their original evidence, and check the evidence&apos;s limits. Then record what you can reasonably use the source to support.</p>
    <p>A source can be useful for one purpose and unsuitable for another. A student survey might describe respondents&apos; preferences without showing that a teaching method improves grades. The worked example below shows how to make that distinction before you add a citation to your essay.</p>

    <section aria-labelledby="source-question">
      <h2 id="source-question">Start with the claim you need evidence for</h2>
      <p>Write your intended claim in one sentence. &quot;Students value access to recorded lectures&quot; and &quot;Recorded lectures improve exam performance&quot; need different evidence. Also check your assignment&apos;s requirements for source types, publication dates, and disciplinary standards.</p>
      <p><a href="https://owl.purdue.edu/owl/research_and_citation/conducting_research/evaluating_sources_of_information/general_guidelines.html">Purdue OWL&apos;s source evaluation guide</a> covers authorship, audience, evidence, cross-checking, and timeliness. Use those questions to make a reasoned decision about a particular claim; counting positive answers does not establish that the claim is true.</p>
      <ol className={styles.checklist}>
        <li><strong>Identify the source and its purpose.</strong> Find the author, publisher, date, relevant expertise, and intended audience. Look for funding or commercial interests that may affect the framing.</li>
        <li><strong>Trace the important claim.</strong> Follow references or links to the original report, study, document, or observation. Read the relevant passage and methods rather than relying on a headline or search snippet.</li>
        <li><strong>Check beyond the source itself.</strong> Look for independent information about the author or publisher and compare the claim with other relevant evidence. Several pages repeating one report are still one evidence trail.</li>
        <li><strong>Decide its permitted use.</strong> Match the evidence&apos;s population, setting, methods, and date to your claim. Use it for the purpose it supports, qualify the claim, find stronger evidence, or leave it out.</li>
      </ol>
      <p>The <a href="https://library.uwgb.edu/evalinfo/strategies">UW-Green Bay Library&apos;s lateral reading guidance</a> recommends investigating a source from outside its own pages. An impressive design or an &quot;About&quot; page is a starting point for investigation, not the whole check.</p>
    </section>

    <section aria-labelledby="source-example">
      <h2 id="source-example">Source evaluation example: a claim about lecture recordings</h2>
      <p className={styles.note}>Fictional practice exercise. The prompt, report, vendor post, and sample evaluation were created for this article. They are not real research, student work, or RubriCheck results.</p>
      <p><strong>Practice prompt:</strong> Recommend whether a university should continue offering lecture recordings. Evaluate the evidence behind your recommendation and explain a limitation.</p>
      <div className={styles.practice}>
        <h3>The source you find</h3>
        <p>A recording-platform vendor&apos;s blog says, &quot;Recorded lectures improve exam performance.&quot; Its only supporting link leads to a university learning-support team&apos;s report about a voluntary questionnaire for commuting students.</p>
        <h3>The original report</h3>
        <p>The report names its authors, gives the questionnaire dates, and links the questions. Respondents describe using recordings to revisit difficult sections and catch up after travel delays. The report does not measure exam marks, compare students with and without recordings, or claim that its volunteers represent every student. No independent evidence of improved marks is supplied in this exercise.</p>
      </div>
      <p>The named authors and visible method help you inspect the report, but they do not make every conclusion valid. The vendor has a commercial interest worth recognizing; that interest alone does not show its statement is false. The decisive problem here is the gap between the claimed outcome and what the cited report measured.</p>

      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="Trace the fictional performance claim to a defensible use of the evidence">
          <li><strong>Claim</strong><span>The vendor says recordings improve exam marks.</span></li>
          <li><strong>Trace</strong><span>The link leads to a voluntary student questionnaire.</span></li>
          <li><strong>Check the fit</strong><span>The report records experiences, without measuring marks.</span></li>
          <li><strong>Decide the use</strong><span>Use it for respondents&apos; reported benefits; seek outcome evidence.</span></li>
        </ol>
        <figcaption>Follow the claim to the original evidence, compare what was claimed with what was measured, then state a narrower use. In this fictional case, reported benefits can inform a recommendation about access, but cannot establish an effect on exam performance.</figcaption>
      </figure>

      <h3>Weak evaluation: reputation replaces reasoning</h3>
      <blockquote className={styles.example}><p>&quot;This is a reliable source because the vendor cites a university report. The report is recent, so it proves that lecture recordings improve grades.&quot;</p></blockquote>
      <p>The evaluation checks two surface features and stops. It does not inspect the report&apos;s method or notice that exam performance was never measured.</p>
      <h3>Stronger evaluation: evidence, limitation, and use</h3>
      <blockquote className={styles.example}><p>&quot;The learning-support report is useful for discussing how its commuting-student respondents use lecture recordings. It identifies its authors and questionnaire method, and respondents describe benefits for revisiting material and managing travel disruption. However, voluntary participation limits how confidently these experiences can be generalized, and the questionnaire does not measure exam marks. I will use the report as evidence of reported access benefits, while seeking research that measures learning outcomes before claiming that recordings improve performance. The vendor post repeats this report and does not provide a second independent source for that outcome claim.&quot;</p></blockquote>
      <p>This evaluation explains a decision you could defend. It does not give the source a universal quality score or treat an unproven claim as disproved. For a real assignment, replace these practice labels with the actual source details and citations required by your course.</p>
    </section>

    <section aria-labelledby="source-shortcuts">
      <h2 id="source-shortcuts">Avoid shortcuts that hide the evidence</h2>
      <ul className={styles.bulletList}>
        <li><strong>&quot;It is peer reviewed.&quot;</strong> Peer review is useful context. Still inspect whether the research addresses your question and whether its methods and conclusion support your use of it. Check for relevant corrections or retractions.</li>
        <li><strong>&quot;It is the newest source.&quot;</strong> Check whether currency matters to your question. An older original document may be essential for historical analysis, while a current policy claim needs the applicable policy version.</li>
        <li><strong>&quot;It agrees with three other websites.&quot;</strong> Trace their citations. Agreement is less informative if every page repeats the same source, or if the pages omit the same important qualification.</li>
        <li><strong>&quot;It has a point of view.&quot;</strong> Identify that perspective and evaluate its evidence. An advocacy statement may be useful as evidence of an organization&apos;s position even when it cannot establish a disputed factual claim.</li>
      </ul>
      <p><a href="https://owl.purdue.edu/owl/research_and_citation/conducting_research/evaluating_sources_of_information/evaluation_during_reading.html">Purdue OWL&apos;s evaluation-during-reading guide</a> includes checking for unsupported generalizations and considering whether a source is timely for the task. If important details are missing or you cannot access the original, record the uncertainty and look for a source you can inspect. A librarian or instructor can help with an unfamiliar research method.</p>
    </section>

    <section className={styles.practice} aria-labelledby="source-note">
      <h2 id="source-note">Make a short evaluation note before drafting</h2>
      <p>Keep the source&apos;s full citation and page or section reference with your research notes. Then complete these four sentences using details you actually checked:</p>
      <ol className={styles.checklist}>
        <li><strong>I need evidence for...</strong> State the precise claim or question.</li>
        <li><strong>This source provides...</strong> Name its relevant evidence, method, and context.</li>
        <li><strong>Its important limitation is...</strong> Explain what the evidence cannot establish for your claim.</li>
        <li><strong>I will use it to support... / I still need...</strong> Record the allowed use and any further check.</li>
      </ol>
      <p>Follow your course instructions if you are writing a formal source evaluation or annotated bibliography; this note is a research aid, not a universal assessment format. Once you choose the source, <Link href={EXPLAIN_EVIDENCE_POST.path}>explain how its evidence supports your paragraph</Link>. If you use several sources, the <Link href={SYNTHESIS_PARAGRAPH_POST.path}>synthesis paragraph example</Link> shows how to connect their contributions.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="source-cta">
      <p className={styles.eyebrow}>REVIEW YOUR REASONING</p>
      <h2 id="source-cta">Check how your draft uses the evidence</h2>
      <p>After checking your sources yourself, add your draft and a course rubric you are permitted to share to RubriCheck. Compare feedback on evidence or reasoning with the passage and original source. Without a rubric, <Link href="/workspace?start=general&from=blog-source-evaluation#rubric-checker">choose No rubric</Link> and include the assignment instructions for a general review.</p>
      <p>RubriCheck&apos;s AI feedback does not verify source credibility, establish that citations are real, or guarantee a grade. Follow your course&apos;s AI policy and remove unnecessary personal information. Share only material you are allowed to upload; the <Link href="/legal/privacy">privacy policy</Link> explains data processing and service providers.</p>
      <Link href="/workspace?from=blog-source-evaluation#rubric-checker" className={styles.button}>Review my draft&apos;s evidence &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="source-guidance">
      <h2 id="source-guidance">Research guidance and source check</h2>
      <ul>
        <li><a href="https://owl.purdue.edu/owl/research_and_citation/conducting_research/evaluating_sources_of_information/general_guidelines.html">Purdue OWL: Evaluating Sources: General Guidelines</a>: author, audience, supporting evidence, cross-checking, and relevance of the publication date.</li>
        <li><a href="https://library.uwgb.edu/evalinfo/strategies">UW-Green Bay Library: Evaluating Sources: Start Here: Strategies</a>: investigating the author, publisher, and claims through lateral reading.</li>
        <li><a href="https://owl.purdue.edu/owl/research_and_citation/conducting_research/evaluating_sources_of_information/evaluation_during_reading.html">Purdue OWL: Evaluation During Reading</a>: examining evidence, qualifications, accuracy, and timeliness while reading.</li>
      </ul>
      <p>Guide bodies checked 20 November 2026. The lecture-recording exercise, diagram, and evaluation passages are original fictional teaching materials. The universities provide research guidance; they do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
