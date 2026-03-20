import type { MetadataRoute } from "next";
import { SEO_LANDING_PAGES } from "../src/config/seoPages";

const BASE_URL = "https://rubricheck.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...SEO_LANDING_PAGES.map((page) => ({
      url: `${BASE_URL}${page.path}`,
      lastModified,
      changeFrequency:
        page.slug === "how-to-use-a-rubric-to-check-an-assignment"
          ? ("monthly" as const)
          : ("weekly" as const),
      priority:
        page.slug === "rubric-checker" || page.slug === "ai-rubric-grader"
          ? 0.9
          : 0.8,
    })),
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/legal/refund-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/legal/ai-disclaimer`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/legal/data-retention`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  return routes;
}
