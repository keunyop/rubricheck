import Link from "next/link";
import { EXPLAIN_EVIDENCE_POST, REVERSE_OUTLINE_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function TopicSentenceArticle() {
  return <>
    <p className={styles.lead}>A useful topic sentence tells the reader the main point your paragraph will develop. In an argumentative essay, it usually makes a claim you can support. To revise one, identify the paragraph&apos;s actual point, state that point clearly, and check that the evidence and explanation deliver what the sentence promises.</p>
    <p>The topic sentence examples below use a fictional group-project handover. They show the difference between naming a subject, announcing a discussion, and making a focused point. Use the method with your own assignment and sources rather than copying a sentence whose evidence you do not have.</p>

    <section aria-labelledby="topic-job">
      <h2 id="topic-job">Give the paragraph one point to develop</h2>
      <p>The <a href="https://writingcenter.fas.harvard.edu/anatomy-body-paragraph">Harvard College Writing Center&apos;s body paragraph guide</a> explains that a topic sentence states a paragraph&apos;s main idea or claim and signals how it contributes to the essay&apos;s argument. Ask two questions: what should the reader understand after this paragraph, and why does that point matter for my answer to the assignment?</p>
      <p>A thesis addresses the essay&apos;s overall argument. A topic sentence usually develops one part of it. You do not need to repeat the entire thesis in every paragraph or fit every paragraph into the same sentence pattern.</p>
      <ol className={styles.checklist}>
        <li><strong>Find the point in the draft.</strong> Read the evidence and explanation. Write what they establish, rather than what you hoped the paragraph would establish.</li>
        <li><strong>State the relationship.</strong> Instead of naming two things, say how they differ, why one matters, or what your analysis shows about them.</li>
        <li><strong>Keep the scope manageable.</strong> A paragraph about one handover document cannot prove that a method solves every team&apos;s problems.</li>
        <li><strong>Check the promise.</strong> Every important part of the opening claim should receive support and explanation in the paragraph.</li>
      </ol>
    </section>

    <section aria-labelledby="topic-example">
      <h2 id="topic-example">Topic sentence examples: from a subject to a focused claim</h2>
      <p className={styles.note}>Fictional practice exercise. The task, handover notes, and draft passages were created for this article. They are not research findings, real student work, or a RubriCheck evaluation.</p>
      <p><strong>Practice prompt:</strong> Compare the two supplied handover notes for a group poster project. Explain which gives an incoming team member more useful context for continuing the work.</p>
      <div className={styles.practice}>
        <h3>Note A: task list</h3>
        <p>&quot;Upload the revised poster. Check the figure labels.&quot;</p>
        <h3>Note B: decision log</h3>
        <p>&quot;Keep the high-contrast headings: the draft print was difficult to read. Check the figure labels before uploading the revised poster.&quot;</p>
      </div>
      <p>Both notes identify work to do. The decision log also records why a design choice was made. That difference gives the paragraph a specific point to explain.</p>

      <h3>1. A subject without a point</h3>
      <blockquote className={styles.example}><p>&quot;Group projects involve different kinds of records.&quot;</p></blockquote>
      <p>This names the general subject, but it leaves the reader unsure what the comparison will establish. It could lead to a list of record types without answering the prompt.</p>
      <h3>2. An announcement without an answer</h3>
      <blockquote className={styles.example}><p>&quot;This paragraph will compare a task list and a decision log.&quot;</p></blockquote>
      <p>The reader knows the activity, but not its result. In this exercise, the sentence can do more useful work by stating the difference the comparison reveals.</p>
      <h3>3. A claim larger than the evidence</h3>
      <blockquote className={styles.example}><p>&quot;Decision logs prevent misunderstandings in every group project.&quot;</p></blockquote>
      <p>The supplied notes do not show what happened in any team, let alone every team. A confident-sounding sentence can still make a promise the paragraph cannot keep.</p>
      <h3>4. A focused claim the paragraph can develop</h3>
      <blockquote className={styles.example}><p>&quot;The decision log makes the supplied handover more useful by explaining the reason behind the team&apos;s design choice.&quot;</p></blockquote>
      <p>This sentence identifies the document, makes a comparison, and names the feature the evidence will explain. Its scope stays with the supplied handover.</p>

      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="Build a topic sentence from the fictional handover comparison">
          <li><strong>Subject</strong><span>Two notes for handing over a poster project.</span></li>
          <li><strong>Difference</strong><span>Only the decision log explains the heading choice.</span></li>
          <li><strong>Main point</strong><span>That reason gives the incoming member useful context.</span></li>
          <li><strong>Paragraph check</strong><span>Quote the difference and explain how the context helps.</span></li>
        </ol>
        <figcaption>Move from the subject to a specific difference, explain why it matters, then check the paragraph against that claim. The diagram describes a writing decision in a fictional exercise, not a measured effect of decision logs.</figcaption>
      </figure>
    </section>

    <section aria-labelledby="topic-paragraph">
      <h2 id="topic-paragraph">Make the rest of the paragraph keep the promise</h2>
      <p>Changing the first sentence is only part of the revision. Here is one way to develop the focused claim using the supplied notes:</p>
      <blockquote className={styles.example}><p>&quot;The decision log makes the supplied handover more useful by explaining the reason behind the team&apos;s design choice. The task list asks the next member to upload the poster and check figure labels, but does not explain any design decisions (Note A). The decision log adds that the high-contrast headings should stay because the draft print was difficult to read (Note B). An incoming member can therefore see the reason for retaining those headings while checking the remaining labels. The log provides both an action and its context, whereas the task list leaves that reason unstated.&quot;</p></blockquote>
      <p>The paragraph delivers the comparison named in the topic sentence. It quotes or paraphrases a detail from each note and explains its relevance. It does not claim that the team actually avoided mistakes or achieved a better grade. In your own essay, use genuine source material and the citations your course requires.</p>
      <p>Now test possible additions. A sentence about how the team divided presentation time would introduce a different issue unless you explain its relevance to the handover comparison. Move it to a paragraph with that purpose or leave it out. For help developing the reasoning after a source detail, use the <Link href={EXPLAIN_EVIDENCE_POST.path}>evidence explanation example</Link>.</p>
    </section>

    <section aria-labelledby="topic-location">
      <h2 id="topic-location">Does a topic sentence always have to come first?</h2>
      <p>No. <a href="https://owl.purdue.edu/owl/general_writing/academic_writing/paragraphs_and_paragraphing/">Purdue OWL&apos;s paragraphing guide</a> notes that topic sentences can appear in different positions and that some paragraphs do not have an explicit one. Placing your main point near the start is a useful drafting choice when you want the reader to understand the paragraph&apos;s direction quickly.</p>
      <p>A brief transition or necessary context may come before it. A narrative, methods section, or close reading may organize paragraphs differently from this comparison exercise. Follow your task and discipline. The useful test is whether a reader can identify the paragraph&apos;s focus and follow its development, not whether every paragraph starts with the same formula.</p>
      <p>Words such as &quot;Furthermore&quot; or &quot;In contrast&quot; can show a relationship to the previous paragraph. They still need a point after them. If you cannot decide which relationship to signal, first check the reasoning and order of the paragraphs.</p>
    </section>

    <section className={styles.practice} aria-labelledby="topic-checklist">
      <h2 id="topic-checklist">A quick revision check for your own draft</h2>
      <ol className={styles.checklist}>
        <li><strong>Underline the main point.</strong> Is it a useful claim or idea, rather than only a subject label or an announcement?</li>
        <li><strong>Match it to the evidence.</strong> Which sentence supports each part of the point? Narrow any claim the evidence cannot support.</li>
        <li><strong>Find the explanation.</strong> Have you told the reader why the evidence matters for that point?</li>
        <li><strong>Check the focus.</strong> Does each sentence develop the point or provide context the reader needs? Move unrelated ideas.</li>
        <li><strong>Read the neighboring paragraphs.</strong> Does this paragraph add a distinct step toward the essay&apos;s answer?</li>
      </ol>
      <p>Read all your topic sentences together for a quick sense of the argument. Then inspect the actual paragraphs: clear openings can still hide missing support. If several paragraphs repeat a point or appear in the wrong order, make a <Link href={REVERSE_OUTLINE_POST.path}>reverse outline of the draft</Link> before polishing individual sentences.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="topic-cta">
      <p className={styles.eyebrow}>REVIEW YOUR PARAGRAPHS</p>
      <h2 id="topic-cta">Check the revised draft against your criteria</h2>
      <p>Add your draft and a course rubric you are permitted to share to RubriCheck. Compare feedback on focus, organization, or reasoning with the paragraph you revised. Verify that any suggested problem is present in your text before changing it.</p>
      <p>If you have no rubric, <Link href="/workspace?start=general&amp;from=blog-topic-sentence#rubric-checker">review with No rubric selected</Link> and include your assignment instructions. General criteria do not reproduce your instructor&apos;s grading scheme.</p>
      <p>AI feedback and estimated scores can be wrong and do not guarantee a grade or verify sources. Follow your course&apos;s AI policy, remove unnecessary personal information, and upload only material you are allowed to share. The <Link href="/legal/privacy">privacy policy</Link> explains data processing and service providers.</p>
      <Link href="/workspace?from=blog-topic-sentence#rubric-checker" className={styles.button}>Review my paragraphs &rarr;</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="topic-sources">
      <h2 id="topic-sources">Writing guidance and source check</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/anatomy-body-paragraph">Harvard College Writing Center: Anatomy of a Body Paragraph</a>: the topic sentence&apos;s main point and connection to the wider argument, supported by evidence and analysis.</li>
        <li><a href="https://owl.purdue.edu/owl/general_writing/academic_writing/paragraphs_and_paragraphing/">Purdue OWL: On Paragraphs</a>: paragraph focus, development, and different positions for a topic sentence.</li>
      </ul>
      <p>Guide bodies checked 21 November 2026. The project handover exercise, diagram, and draft passages are original fictional teaching materials. The universities provide writing guidance; they do not endorse RubriCheck or verify its feedback.</p>
    </section>
  </>;
}
