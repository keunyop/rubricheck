import type { MetadataRoute } from "next";
import { absoluteUrl } from "../src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    // Admin and billing pages must be crawlable for their noindex directives
    // to be seen. Authentication remains responsible for protecting access.
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
