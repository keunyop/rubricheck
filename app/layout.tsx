import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import { AccountSummaryProvider } from "./components/AccountSummaryProvider";
import { JsonLd } from "./components/JsonLd";
import {
  SITE_URL,
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
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
        url: "/screenshot/Hero.png",
        width: 1200,
        height: 630,
        alt: "RubriCheck app preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RubriCheck",
    description:
      "Check essays and assignments against rubrics with AI-powered feedback, score ranges, and revision guidance.",
    images: ["/screenshot/Hero.png"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <JsonLd data={buildWebSiteSchema()} />
        <JsonLd data={buildOrganizationSchema()} />
        <JsonLd
          data={buildSoftwareApplicationSchema({
            description:
              "RubriCheck helps students and educators evaluate essay and assignment drafts against rubrics with AI-powered feedback.",
          })}
        />
        <AccountSummaryProvider>{children}</AccountSummaryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
