import type { MetadataRoute } from "next";
import { SEO_CONTENT_UPDATED_AT, SEO_LANDING_PAGES } from "../src/config/seoPages";
import { absoluteUrl } from "../src/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), lastModified: SEO_CONTENT_UPDATED_AT },
    ...SEO_LANDING_PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified: SEO_CONTENT_UPDATED_AT,
    })),
    ...[
      "/pricing",
      "/legal/privacy",
      "/legal/terms",
      "/legal/refund-policy",
      "/legal/ai-disclaimer",
      "/legal/data-retention",
    ].map((path) => ({ url: absoluteUrl(path) })),
  ];
}
