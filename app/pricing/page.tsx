import type { Metadata } from "next";

import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing",
  description: "RubriCheck pricing for Pro plans and one-time evaluation top-ups.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    url: "https://rubricheck.com/pricing",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
