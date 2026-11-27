import Link from "next/link";
import { EXPLAIN_EVIDENCE_POST, PARAPHRASING_POST, THESIS_STATEMENT_POST } from "../../src/config/blog";
import { QuotationIntegrationFigure } from "./_components/QuotationIntegrationFigure";
import styles from "./blog.module.css";

export function QuotationIntegrationArticle() {
  return <>
    <p className={styles.lead}>To integrate a quotation, give the quoted words a clear job in your own sentence. Introduce the source or context, choose wording that fits the grammar, add the required citation, and explain the detail you want the reader to notice. Read your words and the quotation together as one sentence.</p>
    <p>This worked example uses a short fictional story passage. It focuses on sentence construction and the analysis of exact words. If you need the source&apos;s idea rather than its phrasing, the <Link href={PARAPHRASING_POST.path}>paraphrasing example</Link> shows a different way to use it.</p>

    <section aria-labelledby="quotation-job">
      <h2 id="quotation-job">Decide why the reader needs these exact words</h2>
      <p>The <a href="https://usingsources.fas.harvard.edu/nuts-bolts-integrating">Harvard Guide to Using Sources</a> explains that a quotation introduced into your prose becomes part of your sentence. The grammar needs to work across that boundary. A source reference identifies the passage, but your surrounding writing must also show how it contributes to your point.</p>
      <p>Before inserting a quotation, finish this thought in your notes: &quot;I need the reader to see these words because...&quot; In a close reading, you might need to examine a contrast, an image, a particular verb, or an ambiguous phrase. Select enough text to preserve that feature and its meaning.</p>
      <p>The goal is a sentence that makes your interpretation visible and lets readers assess it against the source. If you have no point to develop yet, revisit the task or your <Link href={THESIS_STATEMENT_POST.path}>working thesis</Link> before collecting more quotations.</p>
    </section>

    <section aria-labelledby="quotation-example">
      <h2 id="quotation-example">Worked example: quote a contrast in a fictional scene</h2>
      <p className={styles.note}>Fictional practice exercise. The story passage, task, and essay drafts were created for this article. They are not published literature, student work, a study of workers, or a RubriCheck result.</p>
      <p><strong>Practice task:</strong> Analyze how the narration presents the end of Mara&apos;s working day. Explain the relationship between the room and her movements, using precise details from the supplied passage.</p>
      <div className={styles.practice}>
        <h3>Supplied source: Practice story, paragraph 1</h3>
        <p>At noon, Mara switched off the machines. The room was finally quiet, but her hands still moved as if the machines were running. She set her keys on the bench.</p>
        <p className={styles.note}>The source label &quot;Practice story, para. 1&quot; below points to this invented passage. It is an exercise reference, not a complete citation in a named academic style.</p>
      </div>

      <h3>A quotation left to explain itself</h3>
      <blockquote className={styles.example}><p>Mara cannot relax. &quot;The room was finally quiet, but her hands still moved as if the machines were running&quot; (Practice story, para. 1). This shows that work is important.</p></blockquote>
      <p>The quotation is relevant to the task, but the draft leaves its relationship to the claim vague. &quot;Cannot relax&quot; states more about Mara&apos;s experience than the short scene establishes, and &quot;work is important&quot; does not analyze the wording. The next revision needs a more precise point and a sentence that connects it to the selected language.</p>

      <h3>A quotation integrated into an analytical sentence</h3>
      <blockquote className={styles.example}><p>The contrast between a room that is &quot;finally quiet&quot; and hands that &quot;still moved&quot; presents the end of Mara&apos;s work as uneven (Practice story, para. 1). The word &quot;finally&quot; marks the arrival of quiet, while &quot;still&quot; extends the movement beyond that change. The room has become silent before her movements have stopped. This contrast suggests that switching off the equipment does not immediately bring the scene to rest.</p></blockquote>
      <p>The first sentence gives each short quotation a grammatical place inside a comparison. The following sentences explain the contrast rather than repeating the plot. The interpretation stays with the scene&apos;s language: it does not diagnose Mara or establish a general effect of factory work.</p>
      <QuotationIntegrationFigure />
    </section>

    <section aria-labelledby="quotation-patterns">
      <h2 id="quotation-patterns">Three ways to build the sentence</h2>
      <p>Choose a structure that fits both your purpose and the words you want to retain. These examples use short prose quotations with parenthetical exercise references. Follow your course&apos;s citation and punctuation conventions for your actual paper.</p>

      <h3>1. Introduce a complete quotation with a reporting phrase</h3>
      <blockquote className={styles.example}><p>The narrator observes, &quot;The room was finally quiet, but her hands still moved as if the machines were running&quot; (Practice story, para. 1).</p></blockquote>
      <p>Here the reporting phrase introduces a complete statement. The comma follows the introductory reporting verb. Choose the verb accurately: &quot;observes&quot; reports a description, whereas &quot;proves&quot; would claim a kind of certainty this literary passage does not supply.</p>

      <h3>2. Use a clause after &quot;that&quot;</h3>
      <blockquote className={styles.example}><p>The narrator reports that &quot;her hands still moved as if the machines were running&quot; (Practice story, para. 1).</p></blockquote>
      <p>The quoted clause completes &quot;reports that.&quot; No comma separates &quot;that&quot; from its clause in this sentence. Compare the broken construction &quot;Mara is described as &apos;her hands still moved.&apos;&quot; The clause does not fit the words &quot;described as.&quot; Rebuild your introduction instead of adding punctuation to an incompatible structure.</p>

      <h3>3. Weave selected phrases into your own claim</h3>
      <blockquote className={styles.example}><p>The contrast between &quot;finally quiet&quot; and &quot;still moved&quot; separates the workshop&apos;s silence from Mara&apos;s continuing activity (Practice story, para. 1).</p></blockquote>
      <p>The phrases are parts of the writer&apos;s grammatical comparison. They do not need an introductory comma merely because they are quotations. This version is useful when the analysis concerns a small feature of the language. Give readers enough surrounding context to understand what the phrases describe.</p>
    </section>

    <section aria-labelledby="quotation-accuracy">
      <h2 id="quotation-accuracy">Preserve the wording and its context</h2>
      <p><a href="https://owl.purdue.edu/owl/general_writing/punctuation/quotation_marks/extended_rules_for_quotation_marks.html">Purdue OWL&apos;s quotation guidance</a> explains that omissions must preserve the original meaning and grammatical integration, and that additions for clarity belong in brackets. Check any edited quotation against the source before using it.</p>
      <p>In this scene, &quot;as if the machines were running&quot; is a comparison. It does not say that the machines remain switched on. A sentence claiming that Mara keeps working with running equipment would contradict the preceding sentence, where she switches it off.</p>
      <p>You can select a short phrase without quoting the entire passage, as the worked paragraph does. If you omit words from inside a quotation, follow the required ellipsis rules and check what the shortened version implies. Avoid making a quotation fit by silently changing its tense, pronouns, or meaning. If extensive changes seem necessary, choose another excerpt or rewrite your own sentence.</p>
      <p>The references shown here help you trace the invented text. In a real assignment, verify the words in the original edition you used and provide its author, title, page or other location details, and reference entry as your citation style requires. Do not invent a page number for an unpaginated source.</p>
    </section>

    <section className={styles.practice} aria-labelledby="quotation-checklist">
      <h2 id="quotation-checklist">Read the complete sentence, then check its analysis</h2>
      <ol className={styles.checklist}>
        <li><strong>Read across the quotation marks.</strong> Do your introductory words and the quoted words form the sentence you intended?</li>
        <li><strong>Check the boundary.</strong> Does the reporting phrase, clause, or embedded phrase need the punctuation you have used?</li>
        <li><strong>Compare with the source.</strong> Are the wording, context, omissions, and any bracketed additions accurate?</li>
        <li><strong>Identify the source.</strong> Can the reader distinguish the quoted material from your interpretation and locate the original?</li>
        <li><strong>Name the meaningful detail.</strong> Does the analysis explain a particular contrast, word, or feature rather than announcing that the quote proves your point?</li>
      </ol>
      <p>Grammar helps readers follow the sentence; analysis explains why it belongs in the argument. For a broader example of reasoning from source material, see <Link href={EXPLAIN_EVIDENCE_POST.path}>how to explain evidence in an essay</Link>.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="quotation-cta">
      <p className={styles.eyebrow}>REVIEW YOUR PARAGRAPH IN CONTEXT</p>
      <h2 id="quotation-cta">Check the claim around the quotation</h2>
      <p>After checking the quoted words against your source, add your draft and assignment instructions to RubriCheck. Start with No rubric for general criteria, or add a course rubric you are permitted to share. Inspect feedback on clarity and reasoning beside the sentence you revised.</p>
      <p>General criteria do not reproduce your instructor&apos;s marking scheme. AI feedback and estimated scores can be wrong, do not verify sources, and do not guarantee a grade. Follow your course&apos;s AI policy, remove unnecessary personal information, and upload only material you may share. See the <Link href="/legal/privacy">privacy policy</Link> for data processing details.</p>
      <Link href="/workspace?start=general&amp;from=blog-quotation-integration#rubric-checker" className={styles.button}>Review my quotation paragraph &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="quotation-sources">
      <h2 id="quotation-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://usingsources.fas.harvard.edu/nuts-bolts-integrating">Harvard Guide to Using Sources: The Nuts &amp; Bolts of Integrating</a>: introducing source language and fitting quotations into grammatical sentences.</li>
        <li><a href="https://owl.purdue.edu/owl/general_writing/punctuation/quotation_marks/extended_rules_for_quotation_marks.html">Purdue OWL: Extended Rules for Using Quotation Marks</a>: preserving meaning when omitting words or adding context.</li>
      </ul>
      <p>Guide bodies checked 27 November 2026. The story, diagram, and essay passages are original fictional teaching materials. The universities do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
