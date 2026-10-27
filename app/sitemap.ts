import type { MetadataRoute } from "next";
import { SEO_LANDING_PAGES } from "../src/config/seoPages";
import { absoluteUrl, languageAlternates } from "../src/lib/seo";
import { LOCALES, localizedPath } from "../src/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...SEO_LANDING_PAGES.map(page => page.path), "/product", "/help", "/pricing", "/legal/privacy", "/legal/terms", "/legal/refund-policy", "/legal/ai-disclaimer", "/legal/data-retention"];
  return paths.flatMap(path => LOCALES.map(locale => ({
    url: absoluteUrl(localizedPath(path, locale)),
    lastModified: ["hi", "ur", "vi", "zh"].includes(locale) ? "2026-10-26" : ["/product", "/help", "/assignment-rubric-checker", "/essay-rubric-checker", "/pricing", "/legal/privacy", "/legal/data-retention"].includes(path) ? "2026-10-22" : "2026-10-13",
    alternates: { languages: languageAlternates(path) },
  })));
}
