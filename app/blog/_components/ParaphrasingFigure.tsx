import styles from "../blog.module.css";

export function ParaphrasingFigure() {
  return <figure className={styles.evidenceFlow}>
    <ol className={styles.evidenceFlowList} aria-label="Check the meaning and attribution of the fictional pilot-note paraphrase">
      <li><strong>Scope</strong><span>Loose photographs from one donated collection.</span></li>
      <li><strong>Exclusion</strong><span>Bound albums could not be held flat by the scanner.</span></li>
      <li><strong>Limit</strong><span>Files were checked for opening, not image legibility.</span></li>
      <li><strong>Credit</strong><span>Use independent wording and identify the pilot note.</span></li>
    </ol>
    <figcaption>Check what was included, why material was excluded, what the check established, and whose information you are using. These details come from a fictional teaching source; the diagram does not report an actual archive project.</figcaption>
  </figure>;
}
