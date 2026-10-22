import type { Metadata } from "next";
import { GrowthAnalytics } from "./components/GrowthAnalytics";
import { growthEnabled } from "../src/lib/growthServer";
import { Geist, Geist_Mono } from "next/font/google";
import { AccountSummaryProvider } from "./components/AccountSummaryProvider";
import { LanguageProvider } from "./components/LanguageProvider";
import { SiteChrome } from "./components/SiteChrome";
import { getLocale } from "../src/i18n/server";
import { JsonLd } from "./components/JsonLd";
import {
  SITE_URL,
  DEFAULT_OG_IMAGE_PATH,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "../src/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RubriCheck",
    template: "%s | RubriCheck",
  },
  description:
    "RubriCheck is an AI rubric grader and rubric checker for students and educators. Evaluate essay and assignment drafts with criterion-level feedback, score ranges, and revision guidance before submission.",
  applicationName: "RubriCheck",
  referrer: "strict-origin",
  keywords: [
    "ai rubric grader",
    "rubric checker",
    "rubric grading",
    "ai grading assistant",
    "assignment feedback",
    "essay feedback",
    "essay grader",
    "assignment grader",
    "rubric feedback",
    "pre-submission feedback",
    "student writing feedback",
    "teacher rubric tool",
    "draft evaluation",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "RubriCheck",
    title: "RubriCheck",
    description:
      "Use RubriCheck to check essays and assignments against rubrics with AI-powered feedback, score ranges, and revision guidance.",
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "RubriCheck rubric checker for essays and assignments",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RubriCheck",
    description:
      "Check essays and assignments against rubrics with AI-powered feedback, score ranges, and revision guidance.",
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/rubricheck-tab-icon.svg",
    shortcut: "/rubricheck-tab-icon.svg",
    apple: "/rubricheck-tab-icon.svg",
  },
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim()
      ? {
          "msvalidate.01":
            process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION.trim(),
        }
      : undefined,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning data-growth-enabled={growthEnabled() ? "true" : undefined}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <JsonLd data={buildWebSiteSchema()} />
        <JsonLd data={buildOrganizationSchema()} />
        <AccountSummaryProvider><LanguageProvider initialLocale={locale}><SiteChrome>{children}</SiteChrome><GrowthAnalytics /></LanguageProvider></AccountSummaryProvider>
      </body>
    </html>
  );
}
