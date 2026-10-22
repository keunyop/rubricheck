import type { Metadata } from "next";
import { FREE_TRIAL_LIMIT } from "../config/plans";
import { localizedPath, LOCALES, type Locale } from "../i18n/config";
import { translate } from "../i18n/translate";

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
  locale?: Locale;
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

type BuildWebPageSchemaInput = {
  locale?: Locale;
  title: string;
  description: string;
  path: string;
};

type BuildSoftwareApplicationSchemaInput = {
  locale?: Locale;
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
  locale = "en",
}: BuildMetadataInput): Metadata {
  const canonicalPath = localizedPath(normalizePath(path), locale);
  title = translate(locale, title);
  description = translate(locale, description);
  const imageUrl = absoluteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    title,
    description: translate(locale, description),
    keywords: keywords.map(keyword => translate(locale, keyword)),
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      languages: languageAlternates(path),
    },
    openGraph: {
      type: "website",
      locale: { en: "en_US", ko: "ko_KR", ms: "ms_MY" }[locale],
      alternateLocale: LOCALES.filter(value => value !== locale).map(value => ({ en: "en_US", ko: "ko_KR", ms: "ms_MY" })[value]),
      url: absoluteUrl(canonicalPath),
      siteName: SITE_NAME,
      title,
      description: translate(locale, description),
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
      description: translate(locale, description),
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
    inLanguage: ["en", "ko-KR", "ms-MY"],
  };
}

export function buildSoftwareApplicationSchema({
  description,
  path = "/",
  name = SITE_NAME,
  locale = "en",
}: BuildSoftwareApplicationSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": absoluteUrl("/#software"),
    publisher: { "@id": absoluteUrl("/#organization") },
    name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: absoluteUrl(localizedPath(path, locale)),
    description: translate(locale, description),
    inLanguage: locale,
    offers: {
      "@type": "Offer",
      name: translate(locale, "Free trial: {count} evaluations", { count: FREE_TRIAL_LIMIT }),
      url: absoluteUrl(localizedPath("/pricing", locale)),
      price: "0",
      priceCurrency: "CAD",
    },
  };
}

export function buildWebPageSchema({
  title,
  description,
  path,
  locale = "en",
}: BuildWebPageSchemaInput) {
  path = localizedPath(path, locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(path)}#webpage`,
    about: { "@id": absoluteUrl("/#software") },
    name: translate(locale, title),
    url: absoluteUrl(localizedPath(path, locale)),
    description: translate(locale, description),
    isPartOf: {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: SITE_NAME,
      url: SITE_URL,
    },
    inLanguage: locale,
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

export function languageAlternates(path: string) {
  return { en: absoluteUrl(localizedPath(path, "en")), ko: absoluteUrl(localizedPath(path, "ko")), "ko-KR": absoluteUrl(localizedPath(path, "ko")), ms: absoluteUrl(localizedPath(path, "ms")), "ms-MY": absoluteUrl(localizedPath(path, "ms")), "x-default": absoluteUrl(localizedPath(path, "en")) };
}
