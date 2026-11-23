import Link from "next/link";
import { COUNTERARGUMENT_POST, REVERSE_OUTLINE_POST } from "../../src/config/blog";
import { EssayConclusionFigure } from "./_components/EssayConclusionFigure";
import styles from "./blog.module.css";

export function EssayConclusionArticle() {
  return <>
    <p className={styles.lead}>A useful essay conclusion answers the question in light of the argument you have developed, explains why that answer matters, and leaves the reader with a supported implication. Start with what your body paragraphs actually establish. Then write an ending that fits that evidence and the assignment.</p>
    <p>The essay conclusion example below revises a weak ending to a fictional campus planning argument. It shows how to bring the reasoning together without copying the introduction, adding a new statistic, or making a larger claim than the essay can support.</p>

    <section aria-labelledby="conclusion-purpose">
      <h2 id="conclusion-purpose">What should an essay conclusion do?</h2>
      <p>The <a href="https://writingcenter.fas.harvard.edu/conclusions">Harvard College Writing Center&apos;s conclusion guide</a> recommends returning to the main idea, showing its significance, and considering what readers can understand or do after following the argument. It also emphasizes that expectations differ by discipline. Use your assignment instructions to decide whether an implication, an interpretation, or a research question belongs at the end.</p>
      <p>For a short argumentative essay, try three questions: What is my answer now? What does the reasoning show when I put it together? Why should the reader care about that answer? A recommendation can follow when your task calls for one. A literary analysis may instead finish by explaining how its reading changes our understanding of a passage.</p>
      <p>These are decisions to make, not a fixed sentence count. If your course gives a required structure, follow it. Before polishing the ending, use a <Link href={REVERSE_OUTLINE_POST.path}>reverse outline</Link> to check whether the body has developed the answer you want to give.</p>
    </section>

    <section aria-labelledby="conclusion-example">
      <h2 id="conclusion-example">Essay conclusion example: a campus design recommendation</h2>
      <p className={styles.note}>Fictional practice exercise. The prompt, planning documents, and draft passages were created for this article. They are not real research, student work, or a RubriCheck evaluation.</p>
      <p><strong>Practice prompt:</strong> Using the supplied campus map and proposed bike-parking plan, argue which design change the planning committee should prioritize. Explain a limitation of your recommendation.</p>
      <div className={styles.practice}>
        <h3>What the essay has already established</h3>
        <ul className={styles.bulletList}>
          <li>The supplied map marks covered bike parking at the west entrance and no covered bike parking at the east entrance.</li>
          <li>The proposed plan adds uncovered racks at both entrances. The body argues that adding racks leaves the east entrance&apos;s lack of shelter unresolved.</li>
          <li>The body acknowledges that extra racks could address capacity, but the documents provide no occupancy counts to establish a capacity shortage.</li>
          <li>The essay discusses its limits: the documents contain no construction costs or evidence that shelter would change cycling rates. It proposes comparing a covered east-entrance option before approval.</li>
        </ul>
      </div>
      <p>This outline matters because an ending depends on the argument before it. If your essay has not discussed a limitation or possible action, develop that reasoning in the body before relying on it in the conclusion.</p>

      <h3>A weak conclusion</h3>
      <blockquote className={styles.example}><p>&quot;In conclusion, bike parking is important for students. This essay has discussed the map and the plan. Covered parking is the best solution and will make everyone cycle more. The committee must act now to create a sustainable campus.&quot;</p></blockquote>
      <p>The opening names the topic without giving the specific answer. The next sentence lists materials rather than combining the reasoning. The claim about everyone cycling more is unsupported, and the broad appeal to sustainability asks the ending to do work the essay has not done.</p>

      <h3>A revised conclusion</h3>
      <blockquote className={styles.example}><p>&quot;The committee should prioritize a covered bike-parking option at the east entrance. The map and proposed plan show that adding uncovered racks would leave this entrance without the shelter already provided at the west entrance. For the design decision considered here, providing shelter deserves attention alongside the number of spaces. This recommendation does not establish that a covered option is affordable or that it would increase cycling; those limits remain unresolved by the supplied documents. Comparing the cost and feasibility of a covered east-entrance option before approving the design would put the identified gap at the center of the next decision.&quot;</p></blockquote>
      <p>The revision gives the answer, connects it to the document analysis, and explains what that analysis means for the design decision. Its final action follows the proposal already developed in the body. It leaves cost and behavior as open questions instead of presenting them as results.</p>
      <EssayConclusionFigure />
    </section>

    <section aria-labelledby="conclusion-new-ideas">
      <h2 id="conclusion-new-ideas">Can you add a new idea in the conclusion?</h2>
      <p>A concluding implication can help readers see what follows from your analysis. A new fact or major objection may require evidence and explanation that belong earlier. <a href="https://owl.purdue.edu/owl/general_writing/common_writing_assignments/argument_papers/conclusions.html">Purdue OWL&apos;s argument-paper guidance</a> cautions against introducing new points or reaching for an exaggerated final statement.</p>
      <p>In this example, asking the committee to compare an alternative design follows the body&apos;s recommendation. Adding a claim that covered parking reduces theft would introduce another argument. You would need a relevant source, an explanation of what it shows, and a connection to the task before using that claim.</p>
      <p>Similarly, an objection that changes your answer needs a fair response before the ending. Use the <Link href={COUNTERARGUMENT_POST.path}>counterargument paragraph example</Link> to develop that exchange. A conclusion can carry forward the resulting qualification after readers have seen its reasoning.</p>
    </section>

    <section aria-labelledby="conclusion-restatement">
      <h2 id="conclusion-restatement">How do you restate a thesis without repeating it?</h2>
      <p>Write down what the reader now knows because of your analysis. Keep the central answer, but express it with the precision the body has earned. Swapping individual words for synonyms can produce the same introduction again without showing any development.</p>
      <p>An opening thesis for the practice essay might read: &quot;The committee should revise the plan to address the lack of covered parking at the east entrance.&quot; The revised conclusion keeps that position while explaining the specific problem with the proposed racks and the limits of the recommendation. It reminds the reader why the answer follows.</p>
      <p>You do not need to repeat every paragraph in order. In a short essay, select the relationship among the main points that makes your answer convincing. If you cannot explain that relationship, check the body for missing reasoning before adding a polished closing phrase.</p>
    </section>

    <section className={styles.practice} aria-labelledby="conclusion-checklist">
      <h2 id="conclusion-checklist">A revision checklist for your own conclusion</h2>
      <ol className={styles.checklist}>
        <li><strong>Answer the assigned question.</strong> Underline the sentence that states your final position or interpretation. Does it match the task?</li>
        <li><strong>Trace the reasoning.</strong> Point to the body paragraphs that support each substantive claim in the ending.</li>
        <li><strong>Connect the main points.</strong> Explain what they establish together rather than listing paragraph topics.</li>
        <li><strong>Keep the scope consistent.</strong> Retain limits that affect the answer. Do not turn a document comparison into a claim about everyone&apos;s behavior.</li>
        <li><strong>Check the final implication.</strong> Does it follow from the analysis? Move any new evidence or substantial objection into the body and develop it there.</li>
      </ol>
      <p>Read the introduction and conclusion together, then check both against the body. If your answer changed while writing, revise the introduction so it prepares readers for the argument you actually make.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="conclusion-cta">
      <p className={styles.eyebrow}>REVIEW YOUR ENDING</p>
      <h2 id="conclusion-cta">Check the conclusion with the whole draft</h2>
      <p>Add your essay and assignment instructions to RubriCheck. Begin with No rubric for general criteria, or add a course rubric you are permitted to share. Compare feedback on the argument and organization with the ending and the body paragraphs that support it.</p>
      <p>General criteria do not reproduce your instructor&apos;s grading scheme. AI feedback and estimated scores can be wrong, do not verify sources, and do not guarantee a grade. Check suggestions against your text, follow your course&apos;s AI policy, and share only material you are allowed to upload. See the <Link href="/legal/privacy">privacy policy</Link> for data processing details.</p>
      <Link href="/workspace?start=general&amp;from=blog-essay-conclusion#rubric-checker" className={styles.button}>Review my essay conclusion &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="conclusion-sources">
      <h2 id="conclusion-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/conclusions">Harvard College Writing Center: Conclusions</a>: the ending&apos;s relationship to the argument, its significance, and disciplinary expectations.</li>
        <li><a href="https://owl.purdue.edu/owl/general_writing/common_writing_assignments/argument_papers/conclusions.html">Purdue OWL: Conclusions</a>: concluding an argument and avoiding unsupported new points or an exaggerated ending.</li>
      </ul>
      <p>Guide bodies checked 22 November 2026. The bike-parking exercise, diagram, and draft passages are original fictional teaching materials. These universities do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
