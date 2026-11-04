import Link from "next/link";
import { BLOG_INDEX, BLOG_POSTS } from "../../src/config/blog";
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
      <header className={styles.indexHeader}><p className={styles.eyebrow}>THE RUBRICHECK BLOG</p><h1>A clearer next step.<br />For writing and studying.</h1><p>{BLOG_INDEX.description}</p></header>
      {BLOG_POSTS.map(post => <article key={post.path} className={styles.postCard}>
        <p className={styles.eyebrow}>{post.category} · 4 min read</p>
        <h2><Link href={post.path}>{post.title}</Link></h2>
        <p>{post.description}</p>
        <time dateTime={post.date}>{post.date}</time>
      </article>)}
    </div>
  </main>;
}
