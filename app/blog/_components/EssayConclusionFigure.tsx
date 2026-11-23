import styles from "../blog.module.css";

export function EssayConclusionFigure() {
  return <figure className={styles.evidenceFlow}>
    <ol className={styles.evidenceFlowList} aria-label="Trace the bike-parking conclusion back to the essay">
      <li><strong>Answer</strong><span>Prioritize covered parking at the east entrance.</span></li>
      <li><strong>Reason</strong><span>The supplied plan adds racks but leaves that entrance uncovered.</span></li>
      <li><strong>Limit</strong><span>The documents do not establish cost or future cycling rates.</span></li>
      <li><strong>Implication</strong><span>Compare a covered option before approving the design.</span></li>
    </ol>
    <figcaption>The ending follows from the analysis: a design recommendation, its document-based reason, the limits already discussed, and a next decision. These are writing steps in a fictional exercise, not findings about a real campus.</figcaption>
  </figure>;
}
