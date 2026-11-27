import styles from "../blog.module.css";

export function QuotationIntegrationFigure() {
  return <figure className={styles.evidenceFlow}>
    <ol className={styles.evidenceFlowList} aria-label="Build and explain a quotation from the fictional workshop scene">
      <li><strong>Point</strong><span>The room is quiet while Mara&apos;s hands keep moving.</span></li>
      <li><strong>Wording</strong><span>Choose the contrast: “finally quiet” and “still moved.”</span></li>
      <li><strong>Sentence</strong><span>Make both quoted phrases part of your comparison.</span></li>
      <li><strong>Analysis</strong><span>Explain how the two phrases present an uneven ending to work.</span></li>
    </ol>
    <figcaption>State the point, select the words that support it, fit them into a grammatical sentence, and explain their effect. This diagram analyzes an original fictional passage, not real workers or a medical condition.</figcaption>
  </figure>;
}
