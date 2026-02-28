import type { MetadataRoute } from "next";

const BASE_URL = "https://rubricheck.com";
const IS_PRODUCTION_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() === "production";

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

  if (!IS_PRODUCTION_APP_ENV) {
    routes.splice(1, 0, {
      url: `${BASE_URL}/pricing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return routes;
}
