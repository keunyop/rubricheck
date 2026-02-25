import type { Metadata } from "next";

import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing",
  description: "RubriCheck pricing for Pro plans and one-time evaluation top-ups.",
};

export default function PricingPage() {
  return <PricingClient />;
}
