import type { Metadata } from "next";
import { buildMetadata } from "../../src/lib/seo";

import { PricingClient } from "./PricingClient";

export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description: "RubriCheck pricing for Pro plans and one-time evaluation top-ups.",
  path: "/pricing",
});

export default function PricingPage() {
  return <PricingClient />;
}
