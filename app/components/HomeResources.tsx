import Link from "next/link";
import { HOME_FAQ_ITEMS, HOME_INTERNAL_LINKS } from "../../src/config/seoPages";
import styles from "./homeResources.module.css";

export function HomeResources() {
  return <div className={styles.resources}>
    <section aria-labelledby="home-guides-title">
      <h2 id="home-guides-title">Guides for your next draft</h2>
      <nav aria-label="Draft review guides" className={styles.guides}>
        {HOME_INTERNAL_LINKS.map(link => <Link key={link.href} href={link.href}>
          <span>{link.label}</span>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
        </Link>)}
      </nav>
    </section>
    <section aria-labelledby="home-faq-title">
      <h2 id="home-faq-title">Frequently asked questions</h2>
      <div className={styles.faq}>
        {HOME_FAQ_ITEMS.map(item => <details key={item.question}>
          <summary>{item.question}<span aria-hidden="true">+</span></summary>
          <p>{item.answer}</p>
        </details>)}
      </div>
    </section>
  </div>;
}
