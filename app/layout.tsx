import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import { AccountSummaryProvider } from "./components/AccountSummaryProvider";
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
  metadataBase: new URL("https://rubricheck.com"),
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
    url: "https://rubricheck.com",
    siteName: "RubriCheck",
    title: "RubriCheck",
    description:
      "Use RubriCheck to check essays and assignments against rubrics with AI-powered feedback, score ranges, and revision guidance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RubriCheck",
    description:
      "Check essays and assignments against rubrics with AI-powered feedback, score ranges, and revision guidance.",
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
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "RubriCheck",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  url: "https://rubricheck.com",
  description:
    "RubriCheck helps students and educators evaluate essay and assignment drafts against rubrics with AI-powered feedback.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
        <AccountSummaryProvider>{children}</AccountSummaryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
