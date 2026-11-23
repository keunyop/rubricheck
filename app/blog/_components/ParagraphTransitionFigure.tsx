import styles from "../blog.module.css";

export function ParagraphTransitionFigure() {
  return <figure className={styles.evidenceFlow}>
    <ol className={styles.evidenceFlowList} aria-label="Build a transition between the workshop-guide paragraphs">
      <li><strong>Previous point</strong><span>Draft A makes the order of assembly clear.</span></li>
      <li><strong>Relationship</strong><span>That strength has a limit: the diagrams lack descriptions.</span></li>
      <li><strong>Next point</strong><span>Draft B describes the action shown in each diagram.</span></li>
      <li><strong>Bridge</strong><span>Carry forward the numbered sequence, then introduce the missing descriptions.</span></li>
    </ol>
    <figcaption>Link the known point about sequence to a different criterion, diagram descriptions. The revised paragraph names both sides of that relationship. This diagram explains an original fictional writing exercise, not a measured effect of either guide.</figcaption>
  </figure>;
}
