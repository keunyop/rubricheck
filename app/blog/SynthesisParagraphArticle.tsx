import Link from "next/link";
import { COUNTERARGUMENT_POST, EXPLAIN_EVIDENCE_POST, REVERSE_OUTLINE_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function SynthesisParagraphArticle() {
  return <>
    <p className={styles.lead}>A synthesis paragraph brings sources together to answer one question. Explain how their ideas relate and what that relationship lets you conclude. A useful starting question is: what can I say after reading these sources together that a summary of either one would leave out?</p>
    <p>You still need accurate summaries. The extra work is to compare sources on a shared issue, make the connection explicit, and keep your conclusion within the evidence. Adding a second citation or the word &quot;similarly&quot; does not establish that connection by itself.</p>

    <section aria-labelledby="synthesis-method">
      <h2 id="synthesis-method">Start with a question both sources can help answer</h2>
      <p><a href="https://owl.purdue.edu/owl/research_and_citation/conducting_research/research_overview/synthesizing_sources.html">Purdue OWL&apos;s synthesis guide</a> recommends looking for relationships between sources and drawing conclusions from them. Before drafting, write down your paragraph&apos;s question and a brief answer from each relevant source.</p>
      <ol className={styles.checklist}>
        <li><strong>Choose the shared issue.</strong> &quot;How should the library provide quiet study space?&quot; gives you a comparison to make. &quot;What does each article say?&quot; gives you a list.</li>
        <li><strong>Record the evidence and its limits.</strong> Note what each source examined, whose perspective it represents, and what it cannot establish.</li>
        <li><strong>Name the relationship.</strong> Sources may agree, offer different explanations, describe different settings, or qualify one another. They do not have to oppose each other.</li>
        <li><strong>State your inference.</strong> Explain what follows for the assignment question, including uncertainty that changes your answer.</li>
      </ol>
      <p>If the sources address unrelated questions, find a more relevant source or narrow the paragraph. Do not manufacture agreement or disagreement to fit a template.</p>
    </section>

    <section aria-labelledby="synthesis-example">
      <h2 id="synthesis-example">Worked example: two sources, one library decision</h2>
      <p className={styles.note}>Fictional practice exercise. The prompt, source notes, and paragraphs below were created for this article. They are not published studies, real student work, or a RubriCheck evaluation.</p>
      <p><strong>Practice prompt:</strong> Should a university library introduce a quiet floor? Use both supplied sources and explain one limit on your recommendation.</p>
      <div className={styles.practice}>
        <h3>Source A: student consultation note</h3>
        <p>Some students who attended a library consultation asked for a space where they could read without nearby conversation. The note does not say how many students attended or whether their preferences represent the whole university.</p>
        <h3>Source B: room booking note</h3>
        <p>Staff recorded requests for group study rooms during an assessment period. The note gives no information about demand outside that period or about how a quiet floor would affect room availability.</p>
      </div>
      <p>The sources describe two needs: quiet individual study and space for collaborative work. They do not measure the same population or establish that one need is greater. They offer complementary evidence for a design problem.</p>
      <h3>Before: summaries with an unsupported conclusion</h3>
      <blockquote className={styles.example}><p>&quot;Source A says students want somewhere quiet to read. Source B says groups need study rooms. Therefore, the library should make an entire floor silent because most students prefer silence.&quot;</p></blockquote>
      <p>Both sources appear, but the conclusion invents a majority preference. It also leaves the group study evidence disconnected from the recommendation.</p>
      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="How the fictional sources lead to a qualified recommendation">
          <li><strong>A: quiet reading</strong><span>Consultation participants request less conversation.</span></li>
          <li><strong>B: group work</strong><span>Room requests show another use of study space.</span></li>
          <li><strong>Connection</strong><span>The two needs must be considered together.</span></li>
          <li><strong>Inference</strong><span>Test a quiet zone while protecting group space.</span></li>
        </ol>
        <figcaption>The sources inform different parts of the same decision. Together they support considering both uses of space; they do not prove which use is more common or that a proposed layout will work. The pilot recommendation is the writer&apos;s inference.</figcaption>
      </figure>
      <h3>After: explain the relationship and qualify the claim</h3>
      <blockquote className={styles.example}><p>&quot;The library should test a quiet study zone while retaining space for group work. Consultation participants requested somewhere to read without nearby conversation (Source A), while assessment-period room requests indicate a need for collaborative study space (Source B). Read together, these notes suggest that a space plan should account for both activities, rather than treating all study as silent individual work. However, neither note establishes their relative demand across the year. A limited trial, with feedback on both quiet and group spaces, would help the library assess the proposal before committing an entire floor.&quot;</p></blockquote>
      <p>The revision connects each source to a shared focus and identifies what remains unknown. The trial is a recommendation based on limited evidence, not a result reported by either source. In a real assignment, replace the practice labels with citations in your required style and include the corresponding reference entries.</p>
    </section>

    <section aria-labelledby="synthesis-relationships">
      <h2 id="synthesis-relationships">Choose a relationship your evidence supports</h2>
      <p>The <a href="https://writingcenter.unc.edu/tips-and-tools/literature-reviews/">UNC Writing Center&apos;s literature review guide</a> describes organizing a review around ideas and issues that connect sources. The same question helps at paragraph level: why do these sources belong together here?</p>
      <ul className={styles.bulletList}>
        <li><strong>Agreement:</strong> Explain the specific point the sources support and check whether their methods or settings differ. Agreement alone does not make a claim universally true.</li>
        <li><strong>Qualification:</strong> One source may identify a condition under which another&apos;s claim applies. Explain the condition before deciding whether the sources contradict each other.</li>
        <li><strong>Disagreement:</strong> Identify the precise claim in dispute. Different participants, definitions, or measures may help explain the difference; inspect the original sources before deciding.</li>
        <li><strong>Complementary perspectives:</strong> Sources may address different parts of one problem, as the library notes do. Explain the combined implication without pretending they tested the same thing.</li>
      </ul>
      <p>Two sources are enough for this exercise, but there is no universal source count for a paragraph. Follow the assignment and give each source enough explanation. For a difficult passage, first <Link href={EXPLAIN_EVIDENCE_POST.path}>check how you explain individual evidence</Link>. If a source challenges your claim, use the <Link href={COUNTERARGUMENT_POST.path}>counterargument example</Link> to build a fair response.</p>
    </section>

    <section aria-labelledby="synthesis-check">
      <h2 id="synthesis-check">A five-minute check for your paragraph</h2>
      <ol className={styles.checklist}>
        <li><strong>Underline the shared question or claim.</strong> Can a reader tell why the sources appear in this paragraph?</li>
        <li><strong>Mark each source&apos;s contribution.</strong> Check your wording against the original text, including qualifications and relevant context.</li>
        <li><strong>Circle the connection sentence.</strong> It should explain how the ideas relate, rather than merely introduce another author.</li>
        <li><strong>Label your inference.</strong> Separate what you conclude from what a source directly reports. Remove claims the evidence cannot support.</li>
        <li><strong>Check attribution.</strong> Make clear which source supports each statement and where your interpretation begins. Paraphrases still need citations.</li>
      </ol>
      <p>If removing one source leaves the reasoning unchanged, check whether you explained its contribution. It may need a clearer connection, a different paragraph, or replacement. To check how these paragraphs build an argument across the essay, make a <Link href={REVERSE_OUTLINE_POST.path}>reverse outline of your draft</Link>.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="synthesis-cta">
      <p className={styles.eyebrow}>REVIEW YOUR USE OF SOURCES</p>
      <h2 id="synthesis-cta">Check the revised draft against your rubric</h2>
      <p>Add your draft and course rubric to RubriCheck, then inspect feedback on source integration, evidence, or reasoning against the passage you revised. If you have no rubric, choose <strong>No rubric</strong> and include the assignment instructions for a general review. Compare source-related suggestions with the original readings yourself.</p>
      <p>AI feedback and estimated scores are guidance, not an instructor&apos;s grade or verification that sources and citations are accurate. Follow your course&apos;s AI policy and remove personal information you do not need to share.</p>
      <Link href="/workspace?from=blog-synthesis-paragraph#rubric-checker" className={styles.button}>Review my use of sources &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="synthesis-sources">
      <h2 id="synthesis-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://owl.purdue.edu/owl/research_and_citation/conducting_research/research_overview/synthesizing_sources.html">Purdue OWL: Synthesizing Sources</a>: identifying relationships between sources and drawing conclusions without forcing connections.</li>
        <li><a href="https://writingcenter.unc.edu/tips-and-tools/literature-reviews/">UNC Writing Center: Literature Reviews</a>: grouping source material around connected ideas and issues.</li>
      </ul>
      <p>Both guides checked 19 November 2026. The library scenario, source notes, and draft passages are original fictional teaching materials. The universities provide general writing guidance; they do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
