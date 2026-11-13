import Link from "next/link";
import { COMPARE_DRAFTS_POST, CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function CounterargumentArticle() {
  return <>
    <p className={styles.lead}>A counterargument paragraph explains a reasonable objection to your claim, recognizes what it gets right, and shows how your argument responds. Sometimes the strongest response is to narrow your thesis. The example below shows each move.</p>
    <p>Use this guide when your assignment asks you to evaluate competing views or build an argument. Your instructor&apos;s prompt, rubric, evidence requirements, and AI policy come first. A counterargument does not always need its own paragraph.</p>

    <section aria-labelledby="counterargument-start">
      <h2 id="counterargument-start">Choose an objection that could change your argument</h2>
      <p>Ask what a thoughtful reader could reasonably question about your thesis: its evidence, an assumption, the scope of the proposal, or a consequence you have overlooked. Choose an objection that matters to your reasoning.</p>
      <p>The <a href="https://writingcenter.fas.harvard.edu/counterargument">Harvard College Writing Center&apos;s counterargument guide</a> explains that considering objections can help refine an argument. You do not need to invent a weak opposing view simply to defeat it.</p>
      <ol className={styles.checklist}>
        <li><strong>Name the objection:</strong> Which precise part of your claim would a reasonable reader challenge?</li>
        <li><strong>Explain its force:</strong> What evidence or reasoning makes it worth considering?</li>
        <li><strong>Respond:</strong> Can you answer it, qualify your claim, or acknowledge an unresolved limit?</li>
      </ol>
      <p>If your paragraph only describes two opinions, see <Link href={CRITICAL_ANALYSIS_POST.path}>how to move from description to critical analysis</Link> for help making a reasoned judgment.</p>
    </section>

    <section aria-labelledby="counterargument-example">
      <h2 id="counterargument-example">Counterargument paragraph example: library opening hours</h2>
      <p className={styles.note}>Invented practice exercise. The proposal, notes, and paragraphs below are fictional teaching materials. They are not research findings, a real university policy, or a RubriCheck evaluation. Do not cite them as factual evidence.</p>
      <p><strong>Practice task:</strong> Recommend whether a campus library should extend its opening hours. Use the two supplied notes and address one limitation.</p>
      <ul className={styles.bulletList}>
        <li><strong>Fictional headcount note:</strong> Over three teaching weeks, study spaces were occupied at the 10 p.m. weekday closing time. No weekend observations were collected.</li>
        <li><strong>Fictional staffing note:</strong> Longer hours would require additional staffing. No cost estimate or information about staff availability is supplied.</li>
      </ul>
      <p><strong>Starting thesis:</strong> The library should stay open until midnight every day because students need more study time.</p>
      <h3>A weak paragraph dismisses the problem</h3>
      <blockquote className={styles.example}><p>“Some people oppose longer hours because they do not care about students. However, studying is important, so the library should stay open until midnight every day.”</p></blockquote>
      <p>This guesses at opponents&apos; motives. It does not address staffing, explain the observations, or justify the weekend recommendation.</p>
      <h3>A stronger paragraph answers a specific objection</h3>
      <blockquote className={styles.example}><p>“An objection to opening until midnight every day is that the proposal commits the library to extra staffing without showing when that expense is justified. That concern is reasonable: the staffing note contains no cost estimate, and the headcount covers weekdays only. However, occupied spaces at weekday closing provide a reason to investigate later weekday access. They do not show how long students would stay or establish weekend demand. The library should therefore consider a limited weekday pilot, subject to a staffing and cost review, rather than adopt the full seven-day proposal immediately. Recording use during the additional hours would help inform a later decision.”</p></blockquote>
      <p>The response changes the proposal to fit the available evidence. It does not claim that a pilot would certainly be affordable, popular, or successful.</p>
      <ol className={styles.checklist}>
        <li><strong>Objection:</strong> The first sentence identifies the unsupported staffing commitment.</li>
        <li><strong>Concession:</strong> The next sentence accepts the missing cost and weekend evidence.</li>
        <li><strong>Response:</strong> The paragraph explains what the weekday observations justify investigating.</li>
        <li><strong>Revised position:</strong> A conditional weekday pilot replaces an immediate seven-day extension.</li>
      </ol>
      <p>A matching revised thesis would be: <strong>“The library should investigate a limited weekday extension through a pilot, subject to a staffing and cost review, before deciding on permanent longer hours.”</strong></p>
    </section>

    <section aria-labelledby="counterargument-fairness">
      <h2 id="counterargument-fairness">Represent the opposing view fairly</h2>
      <p>A reader should recognize the objection as a position someone could actually hold. Describe its reasoning before evaluating it. Avoid claims about laziness, ignorance, or bad motives unless those claims are relevant and supported.</p>
      <p>The <a href="https://writingcenter.gmu.edu/writing-resources/general-writing-practices/all-about-counterarguments">George Mason University Writing Center</a> recommends presenting opposing positions objectively, recognizing valid aspects, and then responding. A useful self-check is whether someone who holds that position would recognize your account of it.</p>
      <p>If you answer a published author, check and cite the original passage as your course requires. If you anticipate a possible objection, make that status clear. Do not attribute an invented view to researchers, classmates, or experts.</p>
    </section>

    <section aria-labelledby="counterargument-placement">
      <h2 id="counterargument-placement">Put the response where the reader needs it</h2>
      <p>A separate paragraph works when the objection needs explanation and evidence. A brief qualification may fit inside a paragraph when it addresses one local claim. The <a href="https://www.unr.edu/writing-speaking-center/writing-speaking-resources/counterarguments">University of Nevada, Reno&apos;s counterargument guide</a> describes both longer responses and shorter acknowledgments.</p>
      <p>In the library example, address the staffing objection near the recommendation it limits. Follow any structure your instructor requires. Words such as “however” can signal the relationship between ideas, but the reasoning must explain why the objection changes your conclusion, fails to defeat it, or remains unresolved.</p>
    </section>

    <section className={styles.practice} aria-labelledby="counterargument-checklist">
      <h2 id="counterargument-checklist">Check your paragraph against the rubric</h2>
      <p>Use your actual course descriptors. These practice checks help you locate reasoning in your draft; they are not a universal marking scheme.</p>
      <ol className={styles.checklist}>
        <li><strong>Fair account:</strong> Underline the objection and the reason a reader might accept it.</li>
        <li><strong>Evidence:</strong> Match factual claims to sources you have checked. Mark anything the evidence does not establish.</li>
        <li><strong>Response:</strong> Find the sentence that answers the objection instead of merely repeating your thesis.</li>
        <li><strong>Consistency:</strong> Check that your introduction and conclusion reflect any qualification you made.</li>
      </ol>
      <p>If you cannot answer an objection, record the gap and reconsider your claim. After revising, use the same criteria to <Link href={COMPARE_DRAFTS_POST.path}>compare your original and revised drafts</Link>.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="counterargument-cta">
      <p className={styles.eyebrow}>REVIEW YOUR ARGUMENT</p>
      <h2 id="counterargument-cta">Check your draft against your course criteria</h2>
      <p>Add your own essay draft and a rubric you are permitted to share to RubriCheck. Use the feedback to identify passages to review, then compare each suggestion with your argument, assignment instructions, and original sources.</p>
      <p>Without a rubric, general writing criteria can support a review, but they do not reproduce your instructor&apos;s grading scheme. AI feedback can miss context or misread evidence. Verify quotations and citations yourself, remove personal information you do not need to share, and follow your course&apos;s AI rules. Estimated scores cannot guarantee a grade.</p>
      <Link href="/workspace#rubric-checker" className={styles.button}>Check my essay draft →</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="counterargument-sources">
      <h2 id="counterargument-sources">Writing guidance</h2>
      <ul>
        <li><a href="https://writingcenter.fas.harvard.edu/counterargument">Harvard College Writing Center: Counterargument</a></li>
        <li><a href="https://writingcenter.gmu.edu/writing-resources/general-writing-practices/all-about-counterarguments">George Mason University Writing Center: All About Counterarguments</a></li>
        <li><a href="https://www.unr.edu/writing-speaking-center/writing-speaking-resources/counterarguments">University of Nevada, Reno: Counterarguments</a></li>
      </ul>
      <p>Checked 13 November 2026. These guides inform the writing advice. The library exercise and paragraphs were created for this article.</p>
    </section>
  </>;
}
