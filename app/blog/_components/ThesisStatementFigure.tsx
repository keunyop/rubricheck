import styles from "../blog.module.css";

export function ThesisStatementFigure() {
  return <figure className={styles.evidenceFlow}>
    <ol className={styles.evidenceFlowList} aria-label="Build a thesis for the fictional exhibition-label comparison">
      <li><strong>Question</strong><span>Which label explains the reconstruction decision more clearly?</span></li>
      <li><strong>Difference</strong><span>Label B names an alternative and the reason for repair.</span></li>
      <li><strong>Boundary</strong><span>Compare the wording, without claiming a visitor-learning effect.</span></li>
      <li><strong>Claim</strong><span>Label B gives the decision a clearer explanation through those details.</span></li>
    </ol>
    <figcaption>Turn the assignment question into a judgment about a specific difference, keep it within the evidence, and state the answer. This diagram uses fictional exhibit labels; it does not report historical research or visitor testing.</figcaption>
  </figure>;
}
