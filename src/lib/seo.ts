import type { Metadata } from "next";
import { FREE_TRIAL_LIMIT } from "../config/plans";

export const SITE_NAME = "RubriCheck";
export const SITE_URL = "https://rubricheck.com";
export const CANONICAL_HOST = "rubricheck.com";
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";

export type FaqItem = {
  question: string;
  answer: string;
};

export type BreadcrumbItem = {
  name: string;
  path: string;
};

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

type BuildWebPageSchemaInput = {
  title: string;
  description: string;
  path: string;
};

type BuildSoftwareApplicationSchemaInput = {
  description: string;
  path?: string;
  name?: string;
};

function normalizePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function absoluteUrl(path = "/"): string {
  return new URL(normalizePath(path), SITE_URL).toString();
}

export function buildMetadata({
  title,
  description,
  path,
  keywords = [],
}: BuildMetadataInput): Metadata {
  const canonicalPath = normalizePath(path);
  const imageUrl = absoluteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: absoluteUrl(canonicalPath),
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildNoIndexMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-image-preview": "none",
        "max-snippet": 0,
        "max-video-preview": 0,
      },
    },
  };
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/rubricheck-logo.svg"),
  };
}

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    publisher: { "@id": absoluteUrl("/#organization") },
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en-US",
  };
}

export function buildSoftwareApplicationSchema({
  description,
  path = "/",
  name = SITE_NAME,
}: BuildSoftwareApplicationSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": absoluteUrl("/#software"),
    publisher: { "@id": absoluteUrl("/#organization") },
    name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: absoluteUrl(path),
    description,
    inLanguage: "en-US",
    offers: {
      "@type": "Offer",
      name: `Free trial: ${FREE_TRIAL_LIMIT} evaluations`,
      url: absoluteUrl("/pricing"),
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function buildWebPageSchema({
  title,
  description,
  path,
}: BuildWebPageSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(path)}#webpage`,
    about: { "@id": absoluteUrl("/#software") },
    name: title,
    url: absoluteUrl(path),
    description,
    isPartOf: {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: SITE_NAME,
      url: SITE_URL,
    },
    inLanguage: "en-US",
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
