import Link from "next/link";
import { REVERSE_OUTLINE_POST, TOPIC_SENTENCE_POST } from "../../src/config/blog";
import { ParagraphTransitionFigure } from "./_components/ParagraphTransitionFigure";
import styles from "./blog.module.css";

export function ParagraphTransitionArticle() {
  return <>
    <p className={styles.lead}>To connect two essay paragraphs, first explain the relationship between their main points. Then write a bridge that carries a specific idea from the first paragraph into the next. Words such as &quot;however&quot; or &quot;therefore&quot; help only when they accurately describe that relationship.</p>
    <p>These paragraph transition examples use a fictional comparison of two workshop guides. You will revise a vague bridge, choose between several logical relationships, and check when the problem needs a change to the argument rather than another linking word.</p>

    <section aria-labelledby="transition-purpose">
      <h2 id="transition-purpose">What makes a paragraph transition useful?</h2>
      <p>The <a href="https://writingcenter.fas.harvard.edu/transitions">Harvard College Writing Center&apos;s transition guide</a> recommends connecting familiar information to a new idea and identifying the relationship before selecting a transitional word. A reader should be able to see both what you are carrying forward and what the next paragraph adds or changes.</p>
      <p>A topic sentence states the point a paragraph develops. A transition shows how that point relates to what came before. One sentence can do both jobs. For example, &quot;The numbered sequence clarifies the order, but the diagrams still need written descriptions&quot; links back to sequence and gives the next paragraph a focus.</p>
      <p>If neither paragraph has a clear point, start with the <Link href={TOPIC_SENTENCE_POST.path}>topic sentence examples</Link>. A connector cannot make the relationship precise while the claims themselves remain vague.</p>
    </section>

    <section aria-labelledby="transition-worked-example">
      <h2 id="transition-worked-example">Worked example: move from a strength to a limitation</h2>
      <p className={styles.note}>Fictional practice exercise. The prompt, design brief, guide drafts, and essay passages were created for this article. They are not real user testing, research findings, student work, or a RubriCheck result.</p>
      <p><strong>Practice prompt:</strong> Compare two draft guides for a cardboard-model workshop against the supplied brief. Recommend a revision that combines their useful features. Discuss what the documents cannot establish about using the guides.</p>
      <div className={styles.practice}>
        <h3>Supplied brief and guide features</h3>
        <ul className={styles.bulletList}>
          <li><strong>Brief:</strong> Make the order of assembly clear, list the materials before assembly, and describe the action shown in each diagram in words.</li>
          <li><strong>Draft A:</strong> Numbered assembly steps put folding before joining, then adding the roof. The diagrams have no written descriptions, and the guide has no opening materials list.</li>
          <li><strong>Draft B:</strong> An opening materials checklist and a sentence describing the action in each diagram. The assembly sections are not numbered.</li>
          <li><strong>Limit:</strong> No one has tried either guide in this exercise. The documents show design features, not completion times or actual user difficulties.</li>
        </ul>
      </div>

      <h3>First paragraph: establish a specific point</h3>
      <blockquote className={styles.example}><p>&quot;Draft A makes the intended assembly order explicit. Its numbered steps place folding before joining and joining before adding the roof (Draft A). A reader can identify which stage follows the previous one without inferring the sequence from the diagrams. This numbering meets the brief&apos;s requirement for a clear order of assembly.&quot;</p></blockquote>
      <p>The next paragraph will discuss diagram descriptions. That is a new criterion, so the transition should explain why the essay moves there.</p>

      <h3>A vague bridge</h3>
      <blockquote className={styles.example}><p>&quot;Furthermore, Draft B is also useful. It has descriptions. This is another important feature.&quot;</p></blockquote>
      <p>&quot;Furthermore&quot; signals an addition, but the passage never names the relationship between numbered steps and descriptions. &quot;Useful&quot; and &quot;important&quot; also leave the reader guessing which part of the brief the paragraph addresses.</p>

      <h3>A bridge that names the relationship</h3>
      <blockquote className={styles.example}><p>&quot;The numbered sequence clarifies the order, but it does not replace the written diagram descriptions required by the brief. Draft A leaves those descriptions out, whereas Draft B states the action shown in each diagram (Drafts A and B). Those sentences give the guide a way to express the depicted action in words. A combined revision could retain Draft A&apos;s numbering and add descriptions modeled on Draft B, meeting both requirements in the brief.&quot;</p></blockquote>
      <p>The opening repeats a precise idea from the previous paragraph, then identifies its limit. The rest of the paragraph develops the new criterion with details from both drafts. It recommends a document revision without claiming that users would finish faster or make fewer mistakes.</p>
      <ParagraphTransitionFigure />
    </section>

    <section aria-labelledby="transition-relationships">
      <h2 id="transition-relationships">Choose the relationship before the linking phrase</h2>
      <p><a href="https://owl.purdue.edu/owl/general_writing/mechanics/transitions_and_transitional_devices/transitional_devices.html">Purdue OWL&apos;s transitional-device guide</a> groups expressions by the relationships they signal, including addition, comparison, time, and examples. Treat those groups as choices to check against your reasoning. A phrase can fit one sentence and misrepresent the next.</p>

      <h3>Add another relevant point</h3>
      <p><strong>Example:</strong> &quot;Alongside its diagram descriptions, Draft B provides the opening materials checklist required by the brief.&quot;</p>
      <p>This adds a different feature of Draft B. &quot;Alongside&quot; is useful because both features contribute to the comparison. The paragraph should then analyze the checklist instead of repeating the point about descriptions.</p>

      <h3>Compare two approaches on the same criterion</h3>
      <p><strong>Example:</strong> &quot;Unlike Draft A&apos;s numbered assembly steps, Draft B&apos;s sections leave the sequence unnumbered.&quot;</p>
      <p>The sentence keeps the comparison on one dimension: sequence numbering. Explain what that difference means for the brief. Do not imply that an unnumbered guide is automatically impossible to follow.</p>

      <h3>Qualify the scope of a conclusion</h3>
      <p><strong>Example:</strong> &quot;These design differences show how the drafts meet the brief; they do not establish how workshop participants would use either guide.&quot;</p>
      <p>This moves from document analysis to a limitation. The repeated phrase &quot;design differences&quot; tells readers exactly what is being qualified. The following paragraph could explain why user testing would be needed to answer a question about actual use.</p>

      <h3>Draw an inference the evidence supports</h3>
      <p><strong>Example:</strong> &quot;Because Draft A omits the opening materials list, it needs that addition to meet the brief.&quot;</p>
      <p>The reason supports a narrow conclusion about a stated requirement. Compare it with &quot;Draft B has descriptions; therefore, participants will make fewer mistakes.&quot; That second sentence claims an outcome the exercise has not tested. Replacing &quot;therefore&quot; with &quot;moreover&quot; would leave the unsupported claim in place; revise the claim itself.</p>
    </section>

    <section aria-labelledby="transition-placement">
      <h2 id="transition-placement">Where should the transition go?</h2>
      <p>Place the connection where readers need it. The worked revision puts it at the start of the next paragraph, where the essay changes from sequence to descriptions. Sometimes a final sentence in the earlier paragraph prepares that change. A larger change of topic may need a short bridging passage.</p>
      <p>You do not need a linking word at the beginning of every paragraph. A specific repeated concept can make the connection clear. For example, &quot;This missing materials list...&quot; has a clear reference after a paragraph about that omission. &quot;This is important...&quot; may not, especially if the paragraph discussed several features.</p>
      <p>Read the last sentence of one paragraph and the first sentence of the next together. If they appear connected only because both concern the same broad topic, write the relationship in the margin: adds a criterion, contrasts a feature, qualifies a claim, or follows from a reason. Use that explanation to draft the bridge.</p>
    </section>

    <section className={styles.practice} aria-labelledby="transition-checklist">
      <h2 id="transition-checklist">A revision check for your own paragraph transitions</h2>
      <ol className={styles.checklist}>
        <li><strong>Name both points.</strong> Write a short statement of what each paragraph establishes.</li>
        <li><strong>Explain the relationship.</strong> Say how the second point develops, changes, or limits the first. If you cannot, check whether these paragraphs belong next to each other.</li>
        <li><strong>Carry forward a specific idea.</strong> Repeat a key concept or use a reference whose meaning is clear.</li>
        <li><strong>Introduce the new focus.</strong> Make the next paragraph&apos;s contribution visible, then develop it with evidence and explanation.</li>
        <li><strong>Test the signal.</strong> Does a contrast word mark an actual contrast? Does an inference follow from the stated reasons? Remove a connector that implies more than you have shown.</li>
      </ol>
      <p>If the order of several paragraphs is unclear, make a <Link href={REVERSE_OUTLINE_POST.path}>reverse outline of the essay</Link>. Moving a paragraph or developing a missing step may resolve a problem that sentence editing cannot.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="transition-cta">
      <p className={styles.eyebrow}>REVIEW YOUR PARAGRAPH CONNECTIONS</p>
      <h2 id="transition-cta">Check the bridge in the context of your draft</h2>
      <p>Add your essay and assignment instructions to RubriCheck. Start with No rubric for general criteria, or add a course rubric you are permitted to share. Compare feedback on organization and reasoning with the two paragraphs you revised. Check that a suggested gap is present in your text before making an edit.</p>
      <p>General criteria do not reproduce your instructor&apos;s grading scheme. AI feedback and estimated scores can be wrong, do not verify sources, and do not guarantee a grade. Follow your course&apos;s AI policy and share only material you are allowed to upload. See the <Link href="/legal/privacy">privacy policy</Link> for data processing details.</p>
      <Link href="/workspace?start=general&amp;from=blog-paragraph-transition#rubric-checker" className={styles.button}>Review my paragraph transitions &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="transition-sources">
      <h2 id="transition-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/transitions">Harvard College Writing Center: Transitions</a>: connecting familiar and new ideas and choosing a signal that fits the relationship.</li>
        <li><a href="https://owl.purdue.edu/owl/general_writing/mechanics/transitions_and_transitional_devices/transitional_devices.html">Purdue OWL: Transitional Devices</a>: linking expressions grouped by their function.</li>
      </ul>
      <p>Guide bodies checked 23 November 2026. The workshop-guide exercise, diagram, and draft passages are original fictional teaching materials. These universities do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
