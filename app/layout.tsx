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
    default: "RubriCheck | AI Rubric Grading Assistant",
    template: "%s | RubriCheck",
  },
  description:
    "RubriCheck helps students and educators evaluate drafts against rubrics with AI-powered criterion feedback, score ranges, and revision guidance.",
  applicationName: "RubriCheck",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "rubric grading",
    "ai grading assistant",
    "assignment feedback",
    "rubric checker",
    "draft evaluation",
    "student writing feedback",
  ],
  openGraph: {
    type: "website",
    url: "https://rubricheck.com",
    siteName: "RubriCheck",
    title: "RubriCheck | AI Rubric Grading Assistant",
    description:
      "Evaluate assignment drafts against rubrics with criterion-level feedback and actionable revision guidance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RubriCheck | AI Rubric Grading Assistant",
    description:
      "Evaluate assignment drafts against rubrics with criterion-level feedback and actionable revision guidance.",
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
    "RubriCheck helps students and educators evaluate assignment drafts against rubrics with AI-powered feedback.",
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
