import type { Metadata } from "next";
import { BLOG_INDEX, type BlogPost } from "../../src/config/blog";
import { absoluteUrl, DEFAULT_OG_IMAGE_PATH } from "../../src/lib/seo";

export function blogMetadata(post?: BlogPost): Metadata {
  const copy = post ?? BLOG_INDEX;
  return {
    title: copy.title, description: copy.description,
    // Only English editions exist. Do not advertise untranslated alternatives.
    alternates: { canonical: absoluteUrl(copy.path) },
    openGraph: {
      title: copy.title, description: copy.description, url: absoluteUrl(copy.path),
      locale: post?.slug === "descriptive-vs-critical-analysis" ? "en_AU" : "en_US", siteName: "RubriCheck",
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE_PATH), width: 1200, height: 630, alt: "RubriCheck essay revision guides" }],
      ...(post ? { type: "article", publishedTime: post.date, modifiedTime: post.modified } : { type: "website" }),
    },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: [absoluteUrl(DEFAULT_OG_IMAGE_PATH)] },
  };
}
