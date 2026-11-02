import Link from "next/link";
import { BLOG_INDEX, BLOG_POST } from "../../src/config/blog";
import { absoluteUrl } from "../../src/lib/seo";
import { JsonLd } from "../components/JsonLd";
import { blogMetadata } from "./metadata";
import styles from "./blog.module.css";

export const metadata = blogMetadata();

export default function BlogPage() {
  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": absoluteUrl("/blog#webpage"), url: absoluteUrl("/blog"), name: BLOG_INDEX.title, description: BLOG_INDEX.description, inLanguage: "en-US" }} />
    <div className={styles.container}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><span aria-current="page">Blog</span></nav>
      <header className={styles.indexHeader}><p className={styles.eyebrow}>THE RUBRICHECK BLOG</p><h1>A clearer next step.<br />A stronger next draft.</h1><p>{BLOG_INDEX.description}</p></header>
      <article className={styles.postCard}>
        <p className={styles.eyebrow}>{BLOG_POST.category} · 4 min read</p>
        <h2><Link href={BLOG_POST.path}>{BLOG_POST.title}</Link></h2>
        <p>{BLOG_POST.description}</p>
        <time dateTime={BLOG_POST.date}>November 2, 2026</time>
      </article>
    </div>
  </main>;
}
