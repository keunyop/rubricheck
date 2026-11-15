import Link from "next/link";
import { BLOG_POST, EXPLAIN_EVIDENCE_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function NoRubricEssayArticle() {
  return <>
    <p className={styles.lead}>You can check an essay without a grading rubric by using the assignment prompt as your course-specific guide, then reviewing the draft for a clear answer, sound reasoning, relevant evidence, organization, and clarity. This can reveal a useful next edit. It cannot tell you how your instructor will grade the paper.</p>
    <p>First, check your course site and assignment materials for a rubric you may have missed. If there is one, use it. If there is no rubric, do not invent point values or treat a general writing checklist as your instructor&apos;s marking scheme.</p>

    <section aria-labelledby="no-rubric-start">
      <h2 id="no-rubric-start">Start with the instructions you do have</h2>
      <p>Keep the prompt beside your draft. Underline the task verbs, required sources, format, and any questions you must answer. The <a href="https://writingcenter.fas.harvard.edu/tips-reading-assignment-prompt">Harvard College Writing Center</a> recommends reading the assignment prompt carefully before working on the paper. If a requirement is unclear, ask your instructor rather than guessing at a missing grading rule.</p>
      <ol className={styles.checklist}>
        <li><strong>Task:</strong> What must you do: compare, explain, evaluate, or argue?</li>
        <li><strong>Material:</strong> Which readings, data, or examples must you use?</li>
        <li><strong>Boundary:</strong> What length, citation style, deadline, and AI-use rules apply?</li>
      </ol>
      <p>The <Link href={BLOG_POST.path}>assignment requirements checklist</Link> covers the final file and submission details. Here, the next step is to judge the substance of a draft when no course rubric is supplied.</p>
    </section>

    <section aria-labelledby="no-rubric-example">
      <h2 id="no-rubric-example">Worked example: a recommendation that misses the comparison</h2>
      <p className={styles.note}>Invented practice exercise. The prompt, notes, draft, and revisions below are fictional teaching materials. They are not a real campus study, student submission, course rubric, or RubriCheck result. Do not cite the numbers as facts.</p>
      <p><strong>Practice prompt:</strong> Compare printed and QR-code campus maps for new visitors. Recommend an approach using the supplied notes, and discuss one limit of the evidence. No marking rubric is provided.</p>
      <ul className={styles.bulletList}>
        <li><strong>Fictional note A:</strong> At one orientation event, 8 of 12 visitors who asked for directions took a printed map. The note does not record why they chose it.</li>
        <li><strong>Fictional note B:</strong> A QR-code map can be updated without reprinting. The note gives no data on phone access, printing cost, or navigation outcomes.</li>
      </ul>
      <h3>First draft excerpt</h3>
      <blockquote className={styles.example}><p>“The campus should replace printed maps with QR codes. Digital maps are modern and easy to update, so every visitor will prefer them.”</p></blockquote>
      <p>The draft mentions an advantage of QR maps but does not compare the options. “Every visitor” is unsupported; the event note shows that some visitors selected a printed map and gives no reason why. A general review should point to these passages, not assign a made-up grade.</p>

      <figure className={styles.evidenceFlow}>
        <ol className={styles.evidenceFlowList} aria-label="Four-step review of the fictional map essay">
          <li><strong>Prompt</strong><span>Compare both map types.</span></li>
          <li><strong>Draft</strong><span>Only QR benefits appear.</span></li>
          <li><strong>Check</strong><span>Find the missing comparison.</span></li>
          <li><strong>Next edit</strong><span>Use both notes and qualify the claim.</span></li>
        </ol>
        <figcaption>Read the review from left to right: the prompt asks for a comparison; the draft discusses only QR maps; the missing comparison is the main gap; the next edit should use both supplied notes and limit the recommendation.</figcaption>
      </figure>

      <h3>A more defensible revision</h3>
      <blockquote className={styles.example}><p>“QR-code maps may be easier to update, while printed maps remain useful to some visitors: at the orientation event, 8 of 12 people who asked for directions took a printed map. That small, single-event observation does not tell us why they chose paper or what all visitors need. The campus could test a QR map alongside printed copies, then ask visitors which option helped them navigate before deciding whether to reduce printing.”</p></blockquote>
      <p>This version answers the comparison task, uses both notes, and limits the conclusion. It still needs the rest of the essay to address any course requirements about sources, citations, and organization.</p>
    </section>

    <section aria-labelledby="no-rubric-general">
      <h2 id="no-rubric-general">Use general criteria as questions, not a substitute rubric</h2>
      <p>Review the whole draft once for each question below. The <a href="https://writingprogram.wsu.edu/undergraduate-writing-center/writing-guides/revising-your-own-writing/">Washington State University Writing Center&apos;s revision guide</a> suggests making a checklist from the original prompt and any rubric you have. When a rubric is absent, the prompt still gives you concrete checks.</p>
      <ol className={styles.checklist}>
        <li><strong>Task focus:</strong> Can you point to where the essay answers each part of the prompt?</li>
        <li><strong>Reasoning:</strong> Does each major claim have an explanation, not just an assertion?</li>
        <li><strong>Evidence:</strong> Are source details accurate, relevant, and cited as required? For a paragraph-level example, see <Link href={EXPLAIN_EVIDENCE_POST.path}>how to explain evidence</Link>.</li>
        <li><strong>Organization:</strong> Can a reader follow the route from the main claim through the supporting points?</li>
        <li><strong>Clarity:</strong> Are key terms and conclusions specific enough to check?</li>
      </ol>
      <p>Mark one passage and one next edit for each gap you find. If the prompt calls for a lab method, personal reflection, or discipline-specific format, apply those instructions too. General criteria cannot reveal a hidden requirement or determine the weighting your instructor will use.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="no-rubric-cta">
      <p className={styles.eyebrow}>START A DRAFT REVIEW</p>
      <h2 id="no-rubric-cta">Check your essay with general criteria</h2>
      <p>In RubriCheck, choose <strong>No rubric</strong>, add your essay draft, and include the assignment instructions if you have them. Read the feedback beside your prompt and verify each suggestion against your draft and sources. If your instructor later supplies a rubric, use that for a course-specific review.</p>
      <p>General-criteria feedback and estimated scores are AI guidance, not your instructor&apos;s grading scheme or a grade prediction. Remove personal information you do not need to share and follow your course&apos;s AI policy.</p>
      <Link href="/workspace?start=general&from=blog-no-rubric-essay#rubric-checker" className={styles.button}>Check my essay without a rubric →</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="no-rubric-sources">
      <h2 id="no-rubric-sources">Writing guidance</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/tips-reading-assignment-prompt">Harvard College Writing Center: Tips for Reading an Assignment Prompt</a></li>
        <li><a href="https://writingprogram.wsu.edu/undergraduate-writing-center/writing-guides/revising-your-own-writing/">Washington State University Writing Center: Revising Your Own Writing</a></li>
      </ul>
      <p>Checked 15 November 2026. The map exercise and every draft passage were created for this article. The university guides provide general writing advice; they do not endorse RubriCheck or evaluate its feedback.</p>
    </section>
  </>;
}
