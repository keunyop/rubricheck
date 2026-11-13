import Link from "next/link";
import { BLOG_POST, COMPARE_DRAFTS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function DiscussionResponseArticle() {
  return <>
    <p className={styles.lead}>A useful discussion board response does more than say “I agree.” Name the classmate&apos;s idea you are answering, add a reason or a piece of course evidence, and ask a question that helps the conversation continue. The example below shows how to do that in a short reply.</p>
    <p>This guide is for students writing replies in a US college online course. Your instructor&apos;s prompt, discussion rubric, citation rules, word count, and AI policy come first. Some courses assess an opening post and peer replies separately.</p>

    <section aria-labelledby="discussion-read"><h2 id="discussion-read">Check the task before drafting a reply</h2>
      <p>Read the original prompt and the reply requirements. Identify whether you must respond to a particular question, use a reading, cite a source, post by a deadline, or return to the thread later. Then read the classmate&apos;s point closely enough to describe it fairly in one sentence.</p>
      <p>The <a href="https://uwaterloo.ca/centre-for-teaching-excellence/catalogs/tip-sheets/online-discussions-tips-students">University of Waterloo&apos;s student guide</a> recommends following course-specific instructions, supporting claims with course material, explaining why you agree, and disagreeing respectfully. A reply is part of a dialogue, so a polished paragraph that never addresses the other person&apos;s idea can still miss the task.</p>
      <ol className={styles.checklist}>
        <li><strong>Point:</strong> Which specific claim in the post will you answer?</li>
        <li><strong>Reason:</strong> What example, assigned reading, or course concept supports your response?</li>
        <li><strong>Next step:</strong> What question or implication invites a useful answer?</li>
      </ol>
    </section>

    <section aria-labelledby="discussion-example"><h2 id="discussion-example">Discussion board response example: from agreement to evidence</h2>
      <p className={styles.note}>Invented practice scenario. The prompt, classmate&apos;s post, tally, and replies below are fictional. They are not a real student submission, university survey, course reading, or RubriCheck evaluation. Replace them with your own course material; do not cite this tally as a fact.</p>
      <p><strong>Practice prompt:</strong> A campus dining hall is considering reusable takeout containers. Respond to one classmate&apos;s concern using the supplied class tally, then suggest a question the class could investigate.</p>
      <p><strong>Fictional class tally:</strong> In this exercise, 18 of 30 respondents named convenient return locations as a concern. The tally does not tell us whether they would use the program or where return points should go.</p>
      <blockquote className={styles.example}><p><strong>Classmate&apos;s fictional post:</strong> “If returning a container is inconvenient, students may stop using the program. The proposal needs a clear return plan.”</p></blockquote>
      <h3>A reply that stalls</h3>
      <blockquote className={styles.example}><p>“I agree. Great point!”</p></blockquote>
      <p>This is courteous but leaves the reader unable to tell which part of the proposal matters or what evidence could test the concern. The <a href="https://dept.writing.wisc.edu/wac/newsletter-2/covid-19-writing-resources/evaluating-discussion-posts-for-the-pivot-to-online-instruction/">University of Wisconsin–Madison&apos;s example discussion rubric</a> values specific answers, textual evidence, and productive engagement with a peer&apos;s work. It is an example, not the rubric for your class.</p>
      <h3>A reply that advances the discussion</h3>
      <blockquote className={styles.example}><p>“Your point about return locations changes how I read the proposal. In the class tally, 18 of 30 respondents raised convenience as a concern. That makes the return plan worth testing, although the tally does not show that the program would fail. Could a short trial with two return points help us learn which locations students would actually use?”</p></blockquote>
      <p>The revision identifies the classmate&apos;s concern, uses the supplied material without overstating it, and asks a question that could guide the next reply. A short trial would provide observations; by itself it would not prove long-term success. If this were a real assignment, cite the actual course source in the format your instructor requires.</p>
    </section>

    <section aria-labelledby="discussion-disagree"><h2 id="discussion-disagree">Disagree without turning the reply into a debate slogan</h2>
      <p>You can challenge a claim while recognizing the part that is reasonable. In the same fictional exercise, a student might write:</p>
      <blockquote className={styles.example}><p>“I agree that return convenience matters, but I would not conclude yet that the proposal should be dropped. The class tally records a concern, not a prediction of participation. What would we need to observe during a small trial before deciding whether the return plan works?”</p></blockquote>
      <p>Address the claim rather than the person. Avoid “everyone knows,” invented statistics, and a citation you have not checked. If the classmate has identified a limitation you cannot answer, say so and ask what information would help. The <a href="https://www.sjsu.edu/writingcenter/docs/handouts/Discussion%20Posts.pdf">San José State University Writing Center&apos;s discussion-post guide</a> also emphasizes reading the prompt, using course material, and keeping a clear main point.</p>
    </section>

    <section className={styles.practice} aria-labelledby="discussion-checklist"><h2 id="discussion-checklist">Four checks before you post</h2>
      <p>Use your course rubric in place of this practice checklist when one is provided.</p>
      <ol className={styles.checklist}>
        <li><strong>Respond:</strong> Underline the sentence that answers the classmate&apos;s actual point.</li>
        <li><strong>Support:</strong> Match each factual claim to the assigned reading, class material, or a source you verified.</li>
        <li><strong>Extend:</strong> Ask one question or draw one implication that a peer could answer.</li>
        <li><strong>Submit:</strong> Check the reply count, length, citation format, deadline, and course AI rules yourself.</li>
      </ol>
      <p>If your assignment also requires an opening post, check its prompt separately. For a longer revision task, see <Link href={COMPARE_DRAFTS_POST.path}>how to compare two drafts with the same rubric</Link>. For a whole-assignment check, use the <Link href={BLOG_POST.path}>assignment requirements checklist</Link>.</p>
    </section>

    <aside className={styles.cta} aria-labelledby="discussion-cta"><p className={styles.eyebrow}>CHECK YOUR OWN REPLY</p><h2 id="discussion-cta">Review a draft against your course criteria</h2>
      <p>Paste your own response draft and your instructor&apos;s reply rubric into RubriCheck to look for missing criteria. Review each suggestion against the actual prompt and course reading before editing. If you do not have a rubric, general writing criteria can help you inspect the draft, but they do not reproduce your instructor&apos;s grading scheme.</p>
      <p>Do not upload a classmate&apos;s identifiable post or private course material without permission. RubriCheck cannot verify what happened in your learning platform, whether you met a posting deadline, or whether an uncited course claim is true. It cannot guarantee a grade.</p>
      <Link href="/workspace?start=general&from=blog-discussion-response#rubric-checker" className={styles.button}>Check my response draft →</Link>
    </aside>

    <section className={styles.sources} aria-labelledby="discussion-sources"><h2 id="discussion-sources">Writing guidance</h2>
      <ul>
        <li><a href="https://uwaterloo.ca/centre-for-teaching-excellence/catalogs/tip-sheets/online-discussions-tips-students">University of Waterloo: online discussions, tips for students</a></li>
        <li><a href="https://dept.writing.wisc.edu/wac/newsletter-2/covid-19-writing-resources/evaluating-discussion-posts-for-the-pivot-to-online-instruction/">University of Wisconsin–Madison: discussion-post rubric examples</a></li>
        <li><a href="https://www.sjsu.edu/writingcenter/docs/handouts/Discussion%20Posts.pdf">San José State University Writing Center: discussion posts</a></li>
      </ul>
      <p>Checked 12 November 2026. These guides inform the writing advice; the dining-hall scenario and replies were created for this article.</p>
    </section>
  </>;
}
