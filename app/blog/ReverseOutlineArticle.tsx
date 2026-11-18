import Link from "next/link";
import { BLOG_POST, EXPLAIN_EVIDENCE_POST, RUBRIC_FEEDBACK_REVISION_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function ReverseOutlineArticle() {
  return <>
    <p className={styles.lead}>A reverse outline is a short map of a draft you have already written. Summarize what each paragraph says and what it does for your argument. Reading those notes in order helps you spot repetition, missing reasoning, and paragraphs that belong somewhere else.</p>
    <p>You do not need to rewrite the whole essay to start. Number the paragraphs, keep the assignment question beside you, and describe the draft as it exists. If you write down what a paragraph should say instead, you can accidentally hide the gap you need to fix.</p>

    <section aria-labelledby="reverse-outline-method">
      <h2 id="reverse-outline-method">How to make a reverse outline</h2>
      <p><a href="https://owl.purdue.edu/owl/general_writing/the_writing_process/reverse_outlining.html">Purdue OWL&apos;s reverse outlining guide</a> separates a paragraph&apos;s topic from the way it advances the argument. Use that distinction to make two brief notes for every paragraph:</p>
      <ol className={styles.checklist}>
        <li><strong>Topic: what does this paragraph say?</strong> Describe its main idea in a short phrase.</li>
        <li><strong>Job: why does the reader need it here?</strong> Name its contribution: introduce the claim, explain evidence, answer an objection, define a necessary term, or draw a conclusion.</li>
      </ol>
      <p>&quot;Cycling on campus&quot; is a topic. &quot;Shows why a repair station might be needed&quot; is a job. If you cannot give a paragraph one clear job, reread it for competing ideas. If the job has no connection to the question, check whether the paragraph belongs in this assignment.</p>
      <p>This is a revision tool, not a required essay formula. Some assignments need a methods section, a reflection, or an extended account of context. Follow the structure your task and discipline require; an essay does not have to contain five paragraphs.</p>
    </section>

    <section aria-labelledby="reverse-outline-example">
      <h2 id="reverse-outline-example">Worked example: the conclusion outruns the draft</h2>
      <p className={styles.note}>Fictional practice exercise. The prompt, facilities note, draft descriptions, and revisions below were created for this article. They are not research findings, a real student submission, or a RubriCheck evaluation.</p>
      <p><strong>Practice prompt:</strong> Should a university install a bicycle repair station? Make a recommendation using the supplied facilities note and discuss a practical limitation.</p>
      <p><strong>Supplied fictional note:</strong> Students have asked the facilities desk for access to a pump and basic repair tools. The note does not record how often a station would be used or what maintenance would cost.</p>
      <p>The draft recommends a pilot in its introduction, spends a paragraph on the history of bicycles, describes the requests, calls maintenance inexpensive without evidence, and ends by recommending permanent stations across campus. Its reverse outline makes the mismatch visible:</p>
      <div className={`${styles.tableWrap} ${styles.scrollTable}`} role="region" aria-label="Reverse outline table; scroll horizontally on small screens" tabIndex={0}>
        <table>
          <caption>Reverse outline of the fictional draft before revision</caption>
          <thead><tr><th scope="col">Paragraph</th><th scope="col">Topic</th><th scope="col">Job in the current draft</th></tr></thead>
          <tbody>
            <tr><th scope="row">P1</th><td>A single-station pilot</td><td>Introduces a limited recommendation.</td></tr>
            <tr><th scope="row">P2</th><td>History of bicycles</td><td>Provides background without connecting it to the decision.</td></tr>
            <tr><th scope="row">P3</th><td>Requests for tools</td><td>Supplies a reason to investigate demand.</td></tr>
            <tr><th scope="row">P4</th><td>Maintenance is inexpensive</td><td>Asserts a benefit but leaves the practical limitation unexplained.</td></tr>
            <tr><th scope="row">P5</th><td>Permanent stations everywhere</td><td>Recommends more than the introduction or evidence supports.</td></tr>
          </tbody>
        </table>
      </div>
      <p>The main problem is not a missing transition word. The draft needs a clearer route from a sign of demand to a recommendation that acknowledges what is unknown.</p>

      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="Revision decisions for four paragraphs in the bicycle repair station draft">
          <li><strong>P2: Background</strong><span>Cut the bicycle history unless the task needs it.</span></li>
          <li><strong>P3: Requests</strong><span>Move the relevant evidence after the claim.</span></li>
          <li><strong>P4: Upkeep</strong><span>Explain the unknown maintenance cost.</span></li>
          <li><strong>P5: Decision</strong><span>Limit the recommendation to a pilot.</span></li>
        </ol>
        <figcaption>Four decisions from the reverse outline: remove unrelated background, bring the requests closer to the claim, develop the practical limitation, and make the conclusion match the limited evidence. These are proposed edits, not measured improvements.</figcaption>
      </figure>
    </section>

    <section aria-labelledby="reverse-outline-revision">
      <h2 id="reverse-outline-revision">Turn the outline into a revised argument</h2>
      <p>Keep P1&apos;s pilot recommendation. Place the requests directly after it, and explain that requests suggest a possible need without proving regular use. Remove the history paragraph if it adds nothing the prompt requires. Replace the unsupported cost claim with a discussion of the missing information.</p>
      <h3>A revised limitation and recommendation</h3>
      <blockquote className={styles.example}><p>&quot;The requests suggest a reason to test a repair station, but they do not establish regular demand. The facilities note also gives no maintenance cost, so it cannot support the claim that upkeep would be inexpensive. The university could begin with one pilot station, record its use and maintenance needs, and use those observations to decide whether to continue or expand the scheme.&quot;</p></blockquote>
      <p>This passage connects the limitation to the decision. In a real essay, use and cite your actual course material; do not present an invented facilities note as evidence. For help with the link between a source and a claim, see <Link href={EXPLAIN_EVIDENCE_POST.path}>how to explain evidence in an essay</Link>.</p>
      <p>Now make another reverse outline from the revised prose. Check whether the explanation you planned actually appears. Moving headings or paragraphs on a planning sheet does not by itself repair a missing sentence in the draft.</p>
    </section>

    <section aria-labelledby="reverse-outline-check">
      <h2 id="reverse-outline-check">Use the same check on your own essay</h2>
      <p>The <a href="https://writingprogram.wsu.edu/undergraduate-writing-center/writing-guides/revising-your-own-writing/">Washington State University revision guide</a> recommends using a reverse outline to decide what to develop, move, cut, or clarify. Once your paragraph notes are ready, work through these questions:</p>
      <ol className={styles.checklist}>
        <li><strong>Missing step:</strong> Does the conclusion rely on a reason or source that no paragraph explains?</li>
        <li><strong>Repetition:</strong> Do two paragraphs make the same point, or does the second add a necessary distinction?</li>
        <li><strong>Order:</strong> Does the reader meet a term, claim, or source before receiving the context needed to understand it?</li>
        <li><strong>Scope:</strong> Does each paragraph help answer the assignment question, including required limitations or alternatives?</li>
        <li><strong>Conclusion:</strong> Does the final recommendation match the evidence and the claim you developed?</li>
      </ol>
      <p>Choose the gap that most affects the answer to the task, then revise that passage. Save sentence-level polishing until the argument has a workable order. The <Link href={RUBRIC_FEEDBACK_REVISION_POST.path}>rubric feedback revision plan</Link> can help you turn an organization comment into one specific edit; the <Link href={BLOG_POST.path}>assignment requirements checklist</Link> covers the final submission checks.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="reverse-outline-cta">
      <p className={styles.eyebrow}>REVIEW THE REVISED DRAFT</p>
      <h2 id="reverse-outline-cta">Check your organization against your rubric</h2>
      <p>After revising, add your essay draft and course rubric to RubriCheck. Compare any organization feedback with the paragraph notes you made yourself, and check that the suggested gap exists in your text. If you have no rubric, choose <strong>No rubric</strong> and include the assignment instructions for a general review.</p>
      <p>AI feedback and estimated scores are guidance, not an instructor&apos;s grade or proof that your sources are accurate. Follow your course&apos;s AI policy and remove personal information you do not need to share.</p>
      <Link href="/workspace?from=blog-reverse-outline#rubric-checker" className={styles.button}>Review my essay draft &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="reverse-outline-sources">
      <h2 id="reverse-outline-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://owl.purdue.edu/owl/general_writing/the_writing_process/reverse_outlining.html">Purdue OWL: Reverse Outlining</a>: distinguishing a paragraph&apos;s topic from its contribution to the argument.</li>
        <li><a href="https://writingprogram.wsu.edu/undergraduate-writing-center/writing-guides/revising-your-own-writing/">Washington State University: Revising Your Own Writing</a>: using a reverse outline to review focus, order, and development.</li>
      </ul>
      <p>Both guides checked 18 November 2026. The bicycle repair station example and all draft passages are original fictional teaching materials. The universities provide general writing guidance; they do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
