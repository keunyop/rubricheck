import Link from "next/link";
import { EXPLAIN_EVIDENCE_POST, SOURCE_EVALUATION_POST, SYNTHESIS_PARAGRAPH_POST } from "../../src/config/blog";
import { ParaphrasingFigure } from "./_components/ParaphrasingFigure";
import styles from "./blog.module.css";

export function ParaphrasingArticle() {
  return <>
    <p className={styles.lead}>A useful paraphrase restates a source&apos;s meaning in your own language and sentence structure while making the source clear. Read for the claim, its scope, and its limits. Draft from your understanding, then compare your version with the original and add the citation your assignment requires.</p>
    <p>This paraphrasing example uses an invented archive project note. You will compare a distorted claim, a version that follows the original too closely, and a more faithful restatement. The aim is to represent a source accurately and help readers trace it, rather than reach a target number of changed words.</p>

    <section aria-labelledby="paraphrase-purpose">
      <h2 id="paraphrase-purpose">What needs to stay the same when you paraphrase?</h2>
      <p><a href="https://owl.purdue.edu/owl/research_and_citation/using_research/quoting_paraphrasing_and_summarizing/paraphrasing.html">Purdue OWL&apos;s paraphrasing guide</a> recommends understanding the passage, setting it aside to draft, and comparing the result with the original for accurate meaning and a new form. It also emphasizes documenting the source. Changing the language does not make the information your own finding.</p>
      <p>Look for details that control the claim: who or what it concerns, the conditions under which it applies, what was observed, and what remains unknown. Removing a limit can change a cautious observation into a conclusion the author never made.</p>
      <p>Decide why the passage belongs in your essay before rewriting it. If you need its detailed account, preserve the relevant relationships. If you need only an overview, a summary may be more suitable. Neither choice allows you to present an untested outcome as an established result.</p>
    </section>

    <section aria-labelledby="paraphrase-example">
      <h2 id="paraphrase-example">Paraphrasing example: preserve the limits of a pilot note</h2>
      <p className={styles.note}>Fictional practice exercise. The archive team, project note, draft passages, and source label were created for this article. They are not published research, real archive records, student work, or RubriCheck output.</p>
      <p><strong>Practice task:</strong> Explain what the pilot note establishes about the digitization work and what it leaves unresolved. Paraphrase the relevant information, identify the source, and then explain the limitation in your own analysis.</p>
      <div className={styles.practice}>
        <h3>Supplied source: Pilot note, paragraph 1</h3>
        <p>&quot;The pilot scanned only loose photographs from one donated collection. Bound albums were excluded because the scanner could not hold them flat. The team checked whether the files opened but did not assess image legibility.&quot;</p>
        <p className={styles.note}>Practice source record: Archive digitization team. &quot;Pilot note.&quot; Fictional teaching text supplied above, paragraph 1. References to the pilot note below point back to this invented passage.</p>
      </div>

      <h3>Version 1: fluent wording that changes the meaning</h3>
      <blockquote className={styles.example}><p>&quot;The archive successfully digitized its collection and confirmed that the images were clear (Pilot note, para. 1).&quot;</p></blockquote>
      <p>This version broadens one selected part of a donation into the archive&apos;s collection. It also turns an unassessed property into a positive result: the original never says the images were clear. The source pointer cannot make those claims accurate. Revise the content before polishing the wording.</p>

      <h3>Version 2: mostly replacement words, with the same structure</h3>
      <blockquote className={styles.example}><p>&quot;The trial scanned just separate photographs from a single donated collection. Bound albums were left out because the scanner could not keep them flat. The group checked if the files opened but did not evaluate image legibility (Pilot note, para. 1).&quot;</p></blockquote>
      <p>The sequence and sentence patterns closely track the original, with small substitutions such as &quot;trial&quot; for &quot;pilot&quot; and &quot;left out&quot; for &quot;excluded.&quot; A citation identifies the source, but it does not turn this into an independent restatement. The <a href="https://usingsources.fas.harvard.edu/what-constitutes-plagiarism-0">Harvard Guide to Using Sources</a> explains that inadequate paraphrasing can retain too much source language or structure even when a citation is present.</p>

      <h3>Version 3: a restatement organized around the task</h3>
      <blockquote className={styles.example}><p>&quot;According to the pilot note, the files were tested for whether they could be opened, leaving the readability of the images unassessed. The digitization work covered loose photographs from a single donation; it did not include albums, which the equipment could not keep flat (Pilot note, para. 1).&quot;</p></blockquote>
      <p>This version begins with what the check established because that matters to the practice question. It then explains the material covered and the reason for the exclusion. The wording and organization change while the important boundaries remain: one donation, loose photographs, albums excluded for an equipment reason, and no legibility assessment.</p>
      <p>The parenthetical labels here are exercise pointers, not a model citation in a named style. For a real assignment, use the source&apos;s actual author, title, date, and location details in the format your course requires. Do not cite this fictional note as evidence about digitization.</p>
      <ParaphrasingFigure />
    </section>

    <section aria-labelledby="paraphrase-analysis">
      <h2 id="paraphrase-analysis">Keep the source&apos;s account separate from your interpretation</h2>
      <p>After presenting the source information, explain why it matters for your argument. A clear boundary helps readers distinguish what the source reports from what you conclude about it.</p>
      <p>For the practice task, you could follow Version 3 with:</p>
      <blockquote className={styles.example}><p>&quot;This leaves a gap between creating files that open and establishing that their contents can be read. A review of image legibility would be needed before using this note to claim that the scans provide readable access to the photographed material.&quot;</p></blockquote>
      <p>This analysis identifies a question the source has not answered. It does not claim that any images were unreadable. &quot;Not assessed&quot; means the note supplies no assessment, rather than a finding of success or failure. Keep that distinction when writing about missing evidence.</p>
      <p>If your passage reports source details without explaining their relevance, use the <Link href={EXPLAIN_EVIDENCE_POST.path}>evidence explanation example</Link>. If you are unsure what the source can support in the first place, start with the <Link href={SOURCE_EVALUATION_POST.path}>source evaluation example</Link>.</p>
    </section>

    <section aria-labelledby="paraphrase-quote">
      <h2 id="paraphrase-quote">When should you quote or summarize instead?</h2>
      <p>The <a href="https://usingsources.fas.harvard.edu/summarizing-paraphrasing-and-quoting-0">Harvard guide to summary, paraphrase, and quotation</a> distinguishes a condensed overview from a detailed restatement and recommends quoting when readers need to see the source&apos;s actual language. Choose the form that serves the point you are developing.</p>
      <p>If you were analyzing how the project defined success, the wording &quot;did not assess image legibility&quot; could merit a brief quotation with attribution. If you needed only an overview, you might summarize the note as describing a limited scanning exercise with an incomplete assessment of the resulting images. That overview still needs a source citation and should not suggest that the entire collection was scanned.</p>
      <p>Some terms identify the subject precisely: &quot;scanner&quot; and &quot;photographs&quot; do not need awkward replacements for their own sake. Rebuild the explanation from your understanding, and identify distinctive wording you choose to quote. Do not use a percentage of changed words as a substitute for checking meaning, phrasing, and attribution.</p>
    </section>

    <section className={styles.practice} aria-labelledby="paraphrase-checklist">
      <h2 id="paraphrase-checklist">A final check beside the original source</h2>
      <ol className={styles.checklist}>
        <li><strong>Compare the claim.</strong> Does your version report the same finding or idea, without adding an outcome?</li>
        <li><strong>Restore important limits.</strong> Check the population or material, conditions, exclusions, and uncertainty that affect your use of the passage.</li>
        <li><strong>Check the expression.</strong> Have you written from your understanding, or followed the original sentence by sentence with replacement words?</li>
        <li><strong>Mark exact wording.</strong> Use quotation marks or the required quotation format for borrowed language you retain.</li>
        <li><strong>Make the source traceable.</strong> Identify whose account you are presenting and supply the citations and reference details your course requires.</li>
      </ol>
      <p>Recheck the surrounding paragraph too. A faithful paraphrase can still be followed by an unsupported conclusion. When you bring several sources together, keep their contributions distinguishable; the <Link href={SYNTHESIS_PARAGRAPH_POST.path}>synthesis paragraph example</Link> shows how to explain a relationship without merging separate findings into one claim.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="paraphrase-cta">
      <p className={styles.eyebrow}>REVIEW THE PARAGRAPH IN CONTEXT</p>
      <h2 id="paraphrase-cta">Check the reasoning after you check the source</h2>
      <p>After comparing your paraphrase with the original yourself, add your draft and assignment instructions to RubriCheck. Start with No rubric for general criteria, or add a course rubric you may share. Inspect any feedback on evidence and reasoning against your passage and the original source.</p>
      <p>General criteria do not reproduce your instructor&apos;s marking scheme. AI feedback and estimated scores can be wrong, do not verify sources, and do not guarantee a grade or acceptable source use. Follow your course&apos;s AI policy, remove unnecessary personal information, and share only material you are permitted to upload. See the <Link href="/legal/privacy">privacy policy</Link> for data processing details.</p>
      <Link href="/workspace?start=general&amp;from=blog-paraphrasing#rubric-checker" className={styles.button}>Review my paragraph and reasoning &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="paraphrase-sources">
      <h2 id="paraphrase-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://owl.purdue.edu/owl/research_and_citation/using_research/quoting_paraphrasing_and_summarizing/paraphrasing.html">Purdue OWL: Paraphrase: Write It in Your Own Words</a>: understanding, redrafting, checking meaning, and documenting a source.</li>
        <li><a href="https://usingsources.fas.harvard.edu/what-constitutes-plagiarism-0">Harvard Guide to Using Sources: What Constitutes Plagiarism?</a>: inadequate paraphrase and attribution.</li>
        <li><a href="https://usingsources.fas.harvard.edu/summarizing-paraphrasing-and-quoting-0">Harvard Guide to Using Sources: Summarizing, Paraphrasing, and Quoting</a>: choosing an appropriate form of source use.</li>
      </ul>
      <p>Guide bodies checked 25 November 2026. The archive note, diagram, and draft passages are original fictional teaching materials. The universities do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
