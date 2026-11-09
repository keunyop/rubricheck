import Link from "next/link";
import { BLOG_POST, REFLECTIVE_WRITING_POST, LAB_DISCUSSION_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function CriticalAnalysisArticle() {
  return <>
    <p className={styles.lead}>To make an essay less descriptive, explain what the evidence lets you conclude, what limits that conclusion, and how it answers your assignment question. Keep enough description for the reader to follow your reasoning, then make a judgement you can support. Adding “however” or a longer quotation does not do that work by itself.</p>
    <p>This guide is for students revising university essays, including those new to academic writing in Australia or the UK. Start with one paragraph your tutor called “too descriptive”. Use the exercise below to identify the missing reasoning before rewriting the whole essay.</p>
    <section aria-labelledby="analysis-difference"><h2 id="analysis-difference">Description gives information; analysis explains its significance</h2>
      <p>You need both. A reader cannot assess your argument without knowing what your source says. The problem is a paragraph that stops at reporting sources and leaves the reader to work out the conclusion.</p>
      <div className={styles.tableWrap}><table><caption>Questions to ask while revising a paragraph</caption><thead><tr><th scope="col">If your draft only…</th><th scope="col">Ask next…</th></tr></thead><tbody>
        <tr><th scope="row">Reports a finding</th><td>What part of my claim does this finding support?</td></tr>
        <tr><th scope="row">Lists two viewpoints</th><td>Where do they agree or conflict, and why does that matter?</td></tr>
        <tr><th scope="row">Names a weakness</th><td>How much does it limit the conclusion I can draw?</td></tr>
        <tr><th scope="row">Gives an opinion</th><td>Which evidence justifies this judgement, and what would change it?</td></tr>
      </tbody></table></div>
      <p>Critical writing does not require disagreeing with every source. You can accept an argument while explaining its scope. Your unit’s task and marking rubric determine the balance; there is no universal percentage of description to remove.</p>
    </section>
    <section aria-labelledby="analysis-example"><h2 id="analysis-example">Worked example: revise the reasoning, not just the wording</h2>
      <p className={styles.note}>Invented practice scenario, not research evidence: a university library trials evening opening for two weeks. Its report says more students visited; a voluntary questionnaire says visitors liked the quiet space. The question is whether the university should extend evening hours permanently. No real study or citation is implied.</p>
      <h3>Draft: mostly descriptive</h3>
      <blockquote className={styles.example}><p>The library opened in the evening for two weeks. The report recorded more visits, and the questionnaire found that visitors liked the quiet space. Evening opening was popular.</p></blockquote>
      <p>This tells us what happened. It does not establish whether a permanent extension is justified.</p>
      <h3>Revision: a supported, limited judgement</h3>
      <blockquote className={styles.example}><p>The trial supports continuing evening access on a provisional basis, because increased visits suggest that students used the additional hours. However, a two-week observation cannot establish whether demand would persist across the semester. The voluntary questionnaire describes the views of responding visitors, so it cannot show how students who did not attend would use the service. A longer trial that records attendance and operating costs would provide a firmer basis for a permanent decision.</p></blockquote>
      <p>The revision makes four moves: a judgement, a reason grounded in the reported evidence, a limit on that evidence, and a next step tied to the decision. It does not invent a cost figure or claim that more visits improved grades. In your real essay, cite the actual evidence using the referencing style your course requires.</p>
    </section>
    <section aria-labelledby="analysis-rubric"><h2 id="analysis-rubric">Turn a rubric descriptor into a visible revision</h2>
      <p>Suppose a practice rubric asks you to “evaluate evidence and justify conclusions”. This is an illustrative criterion, not a university marking scheme. Look for the work those verbs require:</p>
      <ol className={styles.checklist}>
        <li><strong>Evaluate:</strong> identify a relevant strength or limitation. In the example, the brief trial limits what we know about sustained demand.</li>
        <li><strong>Justify:</strong> connect your recommendation to the evidence. Continued provisional access follows from observed use; permanent expansion needs more information.</li>
        <li><strong>Answer the task:</strong> check that your final sentence addresses the decision about opening hours, rather than making a general claim about libraries.</li>
      </ol>
      <p>Highlight the sentence that performs each action. If you cannot find one, you have a specific revision task. Do not award yourself a mark from this example: use your own assessment criteria and seek clarification when a descriptor is unclear.</p>
    </section>
    <section aria-labelledby="analysis-exercise"><h2 id="analysis-exercise">A five-minute check on your own paragraph</h2>
      <ol className={styles.checklist}>
        <li>Write the assignment question above the paragraph.</li>
        <li>Underline your claim and circle the evidence supporting it.</li>
        <li>After the evidence, finish this thought in your own words: “This supports my claim because…”</li>
        <li>Identify one relevant limit or alternative explanation. Explain its effect instead of adding a generic criticism.</li>
        <li>Read your conclusion again. Is it stronger than the evidence allows?</li>
      </ol>
      <p>If you have no evidence for a claim, return to your reading. If you have evidence but no explanation, add the missing connection. If the paragraph answers a different question, revise its focus before polishing grammar.</p>
    </section>
    <aside className={styles.cta} aria-labelledby="analysis-cta"><p className={styles.eyebrow}>REVIEW YOUR REVISION</p><h2 id="analysis-cta">Check the draft against your actual criteria</h2>
      <p>Open RubriCheck, add your assignment and use your own rubric when available. Include the task instructions so the feedback has context. If you choose general criteria instead, treat the result as general guidance rather than your university’s marking scheme.</p>
      <Link href="/workspace?start=general#rubric-checker" className={styles.button}>Review my revised draft →</Link>
      <p className={styles.note}>Verify suggestions against your text and original sources. AI feedback does not determine your grade or verify research evidence. Check your course’s rules before uploading work or using AI feedback.</p>
    </aside>
    <section className={styles.sources} aria-labelledby="analysis-sources"><h2 id="analysis-sources">Continue your revision</h2>
      <p>For the whole submission, use the <Link href={BLOG_POST.path}>assignment requirements checklist</Link>. For a broader criterion-by-criterion review, see <Link href="/how-to-use-a-rubric-to-check-an-assignment">how to use a rubric to check an assignment</Link> and the <Link href="/essay-rubric-checker">essay rubric checker</Link>.</p>
      <p>If the assignment asks you to analyse your own experience, use the <Link href={REFLECTIVE_WRITING_POST.path}>worked reflective writing example</Link> to move from the event to its significance and a testable next action.</p>
      <p>For a science or engineering practical, try the <Link href={LAB_DISCUSSION_POST.path}>lab report discussion example</Link> to distinguish observations from explanations and limits.</p>
      <ul><li><a href="https://www.monash.edu/student-academic-success/excel-at-writing/how-to-write/essay/taking-it-further">Monash University: essay writing, description and analysis</a></li><li><a href="https://www.uts.edu.au/for-students/current-students/support/helps/self-help-resources/academic-skills/how-write-critically">University of Technology Sydney: how to write critically</a></li><li><a href="https://library.leeds.ac.uk/info/1401/academic-skills/129/using-your-feedback/4">University of Leeds: acting on feedback about criticality and argument</a></li></ul>
    </section>
  </>;
}
