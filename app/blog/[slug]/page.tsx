import { TopicSentenceArticle } from "../TopicSentenceArticle";
import { SourceEvaluationArticle } from "../SourceEvaluationArticle";
import { SynthesisParagraphArticle } from "../SynthesisParagraphArticle";
import { ReverseOutlineArticle } from "../ReverseOutlineArticle";
import { CriticalAnalysisArticle } from "../CriticalAnalysisArticle";
import { RequirementsArticle } from "../RequirementsArticle";
import { QuizGeneratorArticle } from "../QuizGeneratorArticle";
import { ReflectiveWritingArticle } from "../ReflectiveWritingArticle";
import { LabDiscussionArticle } from "../LabDiscussionArticle";
import { CompareDraftsArticle } from "../CompareDraftsArticle";
import { DiscussionResponseArticle } from "../DiscussionResponseArticle";
import { CounterargumentArticle } from "../CounterargumentArticle";
import { ExplainEvidenceArticle } from "../ExplainEvidenceArticle";
import { NoRubricEssayArticle } from "../NoRubricEssayArticle";
import { RubricFeedbackRevisionArticle } from "../RubricFeedbackRevisionArticle";
import { RubricPointsArticle } from "../RubricPointsArticle";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, TOPIC_SENTENCE_POST, SOURCE_EVALUATION_POST, CRITICAL_ANALYSIS_POST, QUIZ_GENERATOR_POST, REFLECTIVE_WRITING_POST, LAB_DISCUSSION_POST, COMPARE_DRAFTS_POST, DISCUSSION_RESPONSE_POST, COUNTERARGUMENT_POST, EXPLAIN_EVIDENCE_POST, NO_RUBRIC_ESSAY_POST, RUBRIC_FEEDBACK_REVISION_POST, RUBRIC_POINTS_POST, REVERSE_OUTLINE_POST, SYNTHESIS_PARAGRAPH_POST } from "../../../src/config/blog";
import { absoluteUrl, buildBreadcrumbSchema } from "../../../src/lib/seo";
import { JsonLd } from "../../components/JsonLd";
import { blogMetadata } from "../metadata";
import styles from "../blog.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const slug = (await params).slug;
  const post = BLOG_POSTS.find(item => item.slug === slug);
  if (!post) notFound();
  return blogMetadata(post);
}

export default async function BlogArticle({ params }: Props) {
  const slug = (await params).slug;
  const post = BLOG_POSTS.find(item => item.slug === slug);
  if (!post) notFound();
  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <JsonLd data={{
      "@context": "https://schema.org", "@type": "BlogPosting", "@id": absoluteUrl(post.path + "#article"),
      url: absoluteUrl(post.path), mainEntityOfPage: absoluteUrl(post.path), headline: post.title,
      description: post.description, datePublished: post.date, dateModified: post.modified,
      inLanguage: "en", isAccessibleForFree: true,
      author: { "@type": "Organization", name: "RubriCheck", url: absoluteUrl("/product") },
      publisher: { "@id": absoluteUrl("/#organization") },
    }} />
    <JsonLd data={buildBreadcrumbSchema([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: post.title, path: post.path }])} />
    <div className={styles.container}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><Link href="/blog">Blog</Link><span aria-hidden="true"> / </span><span aria-current="page">{post.category}</span></nav>
      <article className={styles.article}>
        <header><p className={styles.eyebrow}>{post.category}</p><h1>{post.title}</h1><p className={styles.byline}>By <Link href="/product">RubriCheck</Link> · <time dateTime={post.date}>{post.date}</time> · {"readingMinutes" in post ? post.readingMinutes : 4} min read</p></header>
        {post.slug === TOPIC_SENTENCE_POST.slug ? <TopicSentenceArticle /> : post.slug === SOURCE_EVALUATION_POST.slug ? <SourceEvaluationArticle /> : post.slug === SYNTHESIS_PARAGRAPH_POST.slug ? <SynthesisParagraphArticle /> : post.slug === REVERSE_OUTLINE_POST.slug ? <ReverseOutlineArticle /> : post.slug === RUBRIC_POINTS_POST.slug ? <RubricPointsArticle /> : post.slug === RUBRIC_FEEDBACK_REVISION_POST.slug ? <RubricFeedbackRevisionArticle /> : post.slug === NO_RUBRIC_ESSAY_POST.slug ? <NoRubricEssayArticle /> : post.slug === EXPLAIN_EVIDENCE_POST.slug ? <ExplainEvidenceArticle /> : post.slug === COUNTERARGUMENT_POST.slug ? <CounterargumentArticle /> : post.slug === DISCUSSION_RESPONSE_POST.slug ? <DiscussionResponseArticle /> : post.slug === COMPARE_DRAFTS_POST.slug ? <CompareDraftsArticle /> : post.slug === LAB_DISCUSSION_POST.slug ? <LabDiscussionArticle /> : post.slug === REFLECTIVE_WRITING_POST.slug ? <ReflectiveWritingArticle /> : post.slug === QUIZ_GENERATOR_POST.slug ? <QuizGeneratorArticle /> : post.slug === CRITICAL_ANALYSIS_POST.slug ? <CriticalAnalysisArticle /> : <RequirementsArticle />}
      </article>
    </div>
  </main>;
}
