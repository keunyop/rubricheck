import Link from "next/link";
import { BLOG_POST, CRITICAL_ANALYSIS_POST } from "../../src/config/blog";
import styles from "./blog.module.css";

export function QuizGeneratorArticle() {
  return <>
    <p className={styles.lead}>To turn notes or a PDF into a useful quiz, choose one learning objective, select only the relevant pages, and generate a small set of questions. Answer before opening the explanation, check the answer against your source, then revisit the ideas you missed. A quiz generator saves question-writing time; the learning still comes from trying to retrieve and explain the answer.</p>
    <p>This guide is for students revising lecture material for a midterm, final or tutorial. You can use your own notes without first submitting an assignment for grading.</p>
    <section aria-labelledby="quiz-source"><h2 id="quiz-source">1. Start with a question your notes can answer</h2>
      <p>Instead of uploading a whole semester, write a target such as: “Can I distinguish a control group from a controlled variable?” Select the section that explains both. A chapter heading alone, an unreadable diagram or a slide saying only “see lecture” gives the generator little evidence to work with.</p>
      <ol className={styles.checklist}>
        <li><strong>Keep the definitions and their example together.</strong> Include the page that explains the diagram, not just the picture.</li>
        <li><strong>Check the extracted text.</strong> Look for missing labels, broken equations or a table read in the wrong order. Use clearer notes if the preview loses essential information.</li>
        <li><strong>Match the source to the assessment.</strong> Use the course learning objectives to decide what to practise. Generated questions do not predict an instructor’s exam.</li>
      </ol>
    </section>
    <section aria-labelledby="quiz-example"><h2 id="quiz-example">2. Try this notes-to-quiz example</h2>
      <p className={styles.note}>Invented practice notes and questions, written for this guide. These are not a captured AI result or a real exam.</p>
      <blockquote className={styles.example}><p>A control group provides a comparison without the treatment being tested. A controlled variable is a condition kept the same between groups. In a seedling experiment, one group receives a new fertiliser and another does not. Both groups receive the same amount of water and light. The measured outcome is growth in height over two weeks.</p></blockquote>
      <p>The objective is to tell the two terms apart and apply them to this experiment. Try answering these before expanding the explanations.</p>
      <div className={styles.practice}>
        <h3>Question 1 · Multiple choice</h3>
        <p>Which is a controlled variable in the example?</p>
        <ol type="A"><li>Whether the seedlings receive fertiliser</li><li>The amount of water each group receives</li><li>The growth in height after two weeks</li></ol>
        <details><summary>Show answer 1</summary><p><strong>B: the amount of water.</strong> It is kept the same. Fertiliser is the treatment being compared; growth is the measured outcome. The no-fertiliser group is the control group, which is different from a controlled variable.</p></details>
        <h3>Question 2 · True or false</h3>
        <p>The group without the new fertiliser provides the comparison for the treatment group.</p>
        <details><summary>Show answer 2</summary><p><strong>True.</strong> This follows from the first sentence of the notes and the description of the two groups. Before moving on, explain aloud why “control group” does not mean “everything kept constant”.</p></details>
      </div>
      <p>A poor question would ask which fertiliser works best: these notes give no results. Reject an answer that invents measurements or treats a missing result as a fact. More questions cannot repair missing source material.</p>
    </section>
    <section aria-labelledby="quiz-create"><h2 id="quiz-create">3. Generate a focused quiz in RubriCheck</h2>
      <ol className={styles.checklist}>
        <li><strong>Open <Link href="/quizzes?view=create">Create a quiz</Link> and sign in.</strong> Choose uploaded material or paste text; you can also start from an existing assignment.</li>
        <li><strong>Add and read the source.</strong> Supported files include PDF, DOCX, PPTX, TXT, PNG and JPG. Select the pages, slides or paragraphs relevant to your learning objective.</li>
        <li><strong>Choose a small question count and a useful focus.</strong> Start with five if your remaining allowance permits. Use a concept review or a specific topic; choose the language and difficulty in Advanced settings.</li>
        <li><strong>Generate, then practise.</strong> The generator produces multiple-choice and true/false questions. Check each answer and explanation, then compare uncertain claims with the original notes.</li>
      </ol>
      <p className={styles.note}>Current limits: up to five sources, 20 MB per file and 50 MB total; selected material is limited to 50 pages or slides and 50,000 characters. Split longer material into focused sections. If a scan is poorly read, use clearer text rather than assuming the missing content was understood.</p>
      <p>A free account includes <strong>10 generated questions in total, with no monthly reset</strong>. Only saved questions count, and repeating a saved quiz is free. Pro includes quiz generation with up to 20 questions per request and no monthly generation limit; grading credits are separate. Check <Link href="/pricing">current plans</Link> before choosing a plan.</p>
    </section>
    <section aria-labelledby="quiz-review"><h2 id="quiz-review">4. Review the mistake, not just the score</h2>
      <figure className={styles.figure}><ol className={styles.steps}>
        <li><span aria-hidden="true">01</span><h3>Attempt</h3><p>Close your notes. Choose an answer and explain your reason before checking it.</p></li>
        <li><span aria-hidden="true">02</span><h3>Verify</h3><p>Read the explanation. Find the source sentence that supports it, especially when the answer surprises you.</p></li>
        <li><span aria-hidden="true">03</span><h3>Return</h3><p>Use mistake review, then try again in a later study session. Explain the idea without relying on remembered answer letters.</p></li>
      </ol><figcaption>A short study loop: attempt → verify → return. Saved progress lets you resume; reviewing mistakes does not require generating another quiz.</figcaption></figure>
      <p>For the seedling example, a useful note is: “I confused the comparison group with the conditions held constant.” Next time, name both in a different experiment. A higher score on repeated questions can reflect familiarity, so also try explaining the distinction with no options visible.</p>
      <p>If the assessment requires an essay, calculation or practical demonstration, practise that format too. Multiple-choice success alone does not establish that you can write an argument or show every step of a calculation.</p>
    </section>
    <aside className={styles.cta} aria-labelledby="quiz-cta"><p className={styles.eyebrow}>USE YOUR OWN COURSE MATERIAL</p><h2 id="quiz-cta">Turn one section of notes into practice.</h2><p>Choose a short source you can check, generate a few questions, and use the explanations to find what needs another look.</p><Link className={styles.button} href="/quizzes?view=create">Create a quiz from my notes →</Link><p className={styles.note}>Sign-in required to generate and save quizzes. Explore the <Link href="/ai-quiz-generator">quiz generator and its prepared sample</Link> first if you want to see the question formats.</p></aside>
    <section className={styles.sources} aria-labelledby="quiz-reading"><h2 id="quiz-reading">Further reading and related guides</h2>
      <p>The University of Melbourne’s <a href="https://students.unimelb.edu.au/academic-skills/study-skills/exam-preparation/exam-revision">exam revision guide</a> describes testing recall with notes covered and spreading study over time. UBC Science’s <a href="https://science.ubc.ca/students/blog/study-tips-from-spac">peer study tips</a> also encourage practice problems alongside notes. These support the study approach, not an endorsement of this tool.</p>
      <p>Preparing written work too? Use our <Link href={BLOG_POST.path}>assignment requirements checklist</Link> and <Link href={CRITICAL_ANALYSIS_POST.path}>critical analysis revision exercise</Link>.</p>
    </section>
  </>;
}
