import Link from "next/link";
import { EXPLAIN_EVIDENCE_POST, REVERSE_OUTLINE_POST, TOPIC_SENTENCE_POST } from "../../src/config/blog";
import { ThesisStatementFigure } from "./_components/ThesisStatementFigure";
import styles from "./blog.module.css";

export function ThesisStatementArticle() {
  return <>
    <p className={styles.lead}>A useful thesis statement gives your essay a central answer that you can develop with the available evidence. Start with the assignment question, identify what your sources allow you to argue, and state a specific claim. Then check that the body of the essay can support every important part of it.</p>
    <p>This thesis statement example works through a fictional comparison of two exhibition labels. It shows how to move from a topic or a summary to an argument with a manageable scope. Use the reasoning process with your own materials; a sentence that fits this exercise may not fit your task.</p>

    <section aria-labelledby="thesis-purpose">
      <h2 id="thesis-purpose">What does a thesis statement need to do?</h2>
      <p>The <a href="https://writingcenter.fas.harvard.edu/thesis">Harvard College Writing Center&apos;s thesis guide</a> describes the thesis as an essay&apos;s central claim. For an analytical essay, it should offer an arguable interpretation with a scope the available evidence can support. Your assignment determines the kind of claim you need: an interpretation, an evaluation, an explanation, or a proposal may require different work.</p>
      <p>In a comparison task, naming two things is a starting point. Your thesis can explain what their difference means for the question you were asked. &quot;The labels are different&quot; leaves that judgment unstated. &quot;Label B explains the reconstruction decision more clearly because it identifies an alternative and a reason for the choice&quot; gives the essay a specific interpretation to develop.</p>
      <p>A thesis governs the whole essay. A <Link href={TOPIC_SENTENCE_POST.path}>topic sentence</Link> gives an individual paragraph a point to develop within that argument. Check both levels: a focused paragraph cannot compensate for an essay whose central answer misses the task.</p>
    </section>

    <section aria-labelledby="thesis-example">
      <h2 id="thesis-example">Thesis statement example: compare two exhibition labels</h2>
      <p className={styles.note}>Fictional practice exercise. The prompt, bridge, dates, exhibit labels, and draft passages were invented for this article. They are not historical evidence, real museum materials, student work, or a RubriCheck evaluation.</p>
      <p><strong>Practice prompt:</strong> Compare how the two supplied labels explain the reconstruction of Riverside Footbridge. Argue which label explains the reconstruction decision more clearly, using details from both texts. Discuss one limit of your interpretation.</p>
      <div className={styles.practice}>
        <h3>Label A</h3>
        <p>&quot;A storm closed Riverside Footbridge in 1932. Residents rebuilt the bridge, and it reopened in 1933.&quot;</p>
        <h3>Label B</h3>
        <p>&quot;Storm damage closed Riverside Footbridge in 1932. The council chose repair over a new upstream crossing to retain the existing walking route. The bridge reopened in 1933.&quot;</p>
      </div>
      <p>Both labels give a closure and reopening sequence. Label B additionally names a choice and its stated reason. The task asks you to judge the explanation of a decision, so that difference is relevant. Neither label provides evidence about how visitors read or understood it.</p>

      <h3>1. A topic that does not answer the question</h3>
      <blockquote className={styles.example}><p>&quot;Museum labels are important for explaining history.&quot;</p></blockquote>
      <p>This introduces a broad subject. It does not compare the supplied labels or say which explanation is clearer. Ask what judgment the essay needs to make about these particular texts.</p>

      <h3>2. A summary without an interpretation</h3>
      <blockquote className={styles.example}><p>&quot;Both labels describe a bridge that closed in 1932 and reopened in 1933.&quot;</p></blockquote>
      <p>This observation is accurate within the exercise, but it repeats information the reader can see. For this prompt, the essay still needs to explain the significance of the different wording.</p>

      <h3>3. A claim the evidence cannot support</h3>
      <blockquote className={styles.example}><p>&quot;Labels that explain reasons always teach visitors history better than labels that list events.&quot;</p></blockquote>
      <p>&quot;Always&quot; reaches beyond two short texts. &quot;Teach visitors better&quot; also changes the question from textual explanation to a learning outcome. The exercise contains no visitor observations or assessments. Narrow the claim rather than adding a cautious word to an untested effect.</p>

      <h3>4. A focused thesis the essay can develop</h3>
      <blockquote className={styles.example}><p>&quot;Although both labels outline the bridge&apos;s closure and reopening, Label B explains the reconstruction decision more clearly by naming the alternative and the reason for retaining the existing route.&quot;</p></blockquote>
      <p>The thesis answers the question, acknowledges a shared feature, and identifies the difference that supports its judgment. A reader still needs the essay&apos;s comparison to assess that interpretation. The claim concerns what the supplied wording explains, keeping visitor learning and historical accuracy outside its scope.</p>
      <ThesisStatementFigure />
    </section>

    <section aria-labelledby="thesis-support">
      <h2 id="thesis-support">Turn the thesis into work for the body paragraphs</h2>
      <p>Underline each substantive part of the focused thesis and ask where the essay will develop it. This gives you concrete checks instead of a promise to &quot;discuss the labels.&quot;</p>
      <ul className={styles.bulletList}>
        <li><strong>Shared sequence:</strong> Compare the closure and reopening details in both labels.</li>
        <li><strong>Alternative:</strong> Explain what naming the new upstream crossing adds to Label B&apos;s account.</li>
        <li><strong>Reason:</strong> Analyze how retaining the existing walking route explains the choice of repair.</li>
        <li><strong>Limit:</strong> Distinguish your interpretation of the wording from claims about historical truth or visitor understanding.</li>
      </ul>
      <p>For example, one part of the body could develop the alternative and reason together:</p>
      <blockquote className={styles.example}><p>&quot;Label B presents repair as a choice rather than only the next event. Its reference to a new upstream crossing identifies an option that was not selected, while retaining the walking route supplies a reason for selecting repair (Label B). Label A says residents rebuilt the bridge but provides neither an alternative nor a reason (Label A). The contrast makes the decision more explicit in Label B, even though the short labels do not let us verify the historical account.&quot;</p></blockquote>
      <p>This passage explains the text details supporting the thesis. It does not infer that the council saved money, that residents preferred repair, or that visitors learned more. For help developing a source detail into reasoning, use the <Link href={EXPLAIN_EVIDENCE_POST.path}>evidence explanation example</Link>. In your assignment, verify quotations against genuine sources and use the required citation style.</p>
    </section>

    <section aria-labelledby="thesis-revise">
      <h2 id="thesis-revise">Can the thesis change while you write?</h2>
      <p>Yes. <a href="https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html">Purdue OWL&apos;s thesis guidance</a> recommends keeping the statement specific and revising it to reflect what the paper actually discusses. Treat an early thesis as a working answer that your analysis may refine.</p>
      <p>Suppose your first thesis says Label B is &quot;more detailed.&quot; While comparing the texts, you discover that extra detail matters here because it explains a choice. Revising the thesis to name the alternative and reason makes the argument more precise. The revision follows your analysis rather than forcing the body to defend an early impression.</p>
      <p>If your evidence challenges the thesis, record the problem and reconsider the claim. Do not omit a relevant passage simply because it complicates your answer. The conclusion and introduction should agree with the argument you ultimately develop.</p>
    </section>

    <section className={styles.practice} aria-labelledby="thesis-checklist">
      <h2 id="thesis-checklist">Check your own thesis against the assignment</h2>
      <ol className={styles.checklist}>
        <li><strong>Find the task.</strong> Does the statement answer the actual comparison, explanation, or evaluation requested?</li>
        <li><strong>Identify your contribution.</strong> For an analytical task, what interpretation does the statement offer beyond summarizing the source?</li>
        <li><strong>Name the basis.</strong> Can you point to the source details and reasoning that support the central judgment?</li>
        <li><strong>Check the boundary.</strong> Look for words such as &quot;all,&quot; &quot;always,&quot; or claims about effects your evidence has not investigated.</li>
        <li><strong>Compare it with the finished draft.</strong> Does every important part receive support? Does the body make a different claim?</li>
      </ol>
      <p>Read the thesis beside your paragraph purposes. A <Link href={REVERSE_OUTLINE_POST.path}>reverse outline</Link> can reveal a missing comparison or paragraphs that pursue a different question. Resolve that mismatch before polishing the sentence.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="thesis-cta">
      <p className={styles.eyebrow}>REVIEW YOUR CENTRAL ANSWER</p>
      <h2 id="thesis-cta">Check the thesis with the draft it promises</h2>
      <p>Add your draft and assignment instructions to RubriCheck. Start with No rubric for general criteria, or add a course rubric you are permitted to share. Compare feedback on focus and reasoning with your thesis and the passages supporting it.</p>
      <p>General criteria do not reproduce your instructor&apos;s marking scheme. AI feedback and estimated scores can be wrong, do not verify sources, and do not guarantee a grade. Check suggestions yourself, follow your course&apos;s AI policy, remove unnecessary personal information, and upload only material you may share. See the <Link href="/legal/privacy">privacy policy</Link> for data processing details.</p>
      <Link href="/workspace?start=general&amp;from=blog-thesis-statement#rubric-checker" className={styles.button}>Review my thesis and draft &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="thesis-sources">
      <h2 id="thesis-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/thesis">Harvard College Writing Center: Thesis</a>: central analytical claims, arguability, and a scope the sources can support.</li>
        <li><a href="https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html">Purdue OWL: Tips and Examples for Writing Thesis Statements</a>: matching the statement to the paper and revising it as the argument develops.</li>
      </ul>
      <p>Guide bodies checked 24 November 2026. The exhibition-label exercise, diagram, and draft passages are original fictional teaching materials. These universities do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
