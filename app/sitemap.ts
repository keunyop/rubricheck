import type { MetadataRoute } from "next";
import { SEO_LANDING_PAGES } from "../src/config/seoPages";
import { absoluteUrl, languageAlternates } from "../src/lib/seo";
import { LOCALES, localizedPath } from "../src/i18n/config";
import { BLOG_INDEX, BLOG_POSTS } from "../src/config/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...SEO_LANDING_PAGES.map(page => page.path), "/ai-quiz-generator", "/product", "/help", "/pricing", "/legal/privacy", "/legal/terms", "/legal/refund-policy", "/legal/ai-disclaimer", "/legal/data-retention"];
  return [...paths.flatMap(path => LOCALES.map(locale => ({
    url: absoluteUrl(localizedPath(path, locale)),
    lastModified: ["/", "/ai-quiz-generator", "/product", "/help", "/pricing", "/legal/data-retention"].includes(path) ? "2026-11-03" : ["hi", "ur", "vi", "zh"].includes(locale) ? "2026-10-26" : ["/assignment-rubric-checker", "/essay-rubric-checker", "/legal/privacy"].includes(path) ? "2026-10-22" : "2026-10-13",
    alternates: { languages: languageAlternates(path) },
  }))), ...([{ path: BLOG_INDEX.path, modified: BLOG_POSTS.map(post => post.modified).sort().at(-1)! }, ...BLOG_POSTS]).map(post => ({ url: absoluteUrl(post.path), lastModified: post.modified }))];
}
