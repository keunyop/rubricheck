import type { MetadataRoute } from "next";
import { SEO_LANDING_PAGES } from "../src/config/seoPages";
import { absoluteUrl, languageAlternates } from "../src/lib/seo";
import { LOCALES, localizedPath } from "../src/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...SEO_LANDING_PAGES.map(page => page.path), "/pricing", "/legal/privacy", "/legal/terms", "/legal/refund-policy", "/legal/ai-disclaimer", "/legal/data-retention"];
  return paths.flatMap(path => LOCALES.map(locale => ({
    url: absoluteUrl(localizedPath(path, locale)),
    lastModified: "2026-10-13",
    alternates: { languages: languageAlternates(path) },
  })));
}
