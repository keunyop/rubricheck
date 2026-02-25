import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import { SubpageBackHomeLink } from "./components/SubpageBackHomeLink";
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

const themeInitScript = `
  (function () {
    try {
      var storedMode = localStorage.getItem("rubricheck_theme_mode");
      var mode = (storedMode === "light" || storedMode === "dark")
        ? storedMode
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var nextTheme = mode === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nextTheme);
    } catch (_error) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
        <SubpageBackHomeLink />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
