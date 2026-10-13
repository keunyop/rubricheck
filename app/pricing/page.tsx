import { getLocale } from "../../src/i18n/server";
import type { Metadata } from "next";
import { buildMetadata } from "../../src/lib/seo";

import { PricingClient } from "./PricingClient";

export async function generateMetadata(): Promise<Metadata> { return buildMetadata({
  locale: await getLocale(),
  title: "Pricing",
  description: "RubriCheck pricing for Pro plans and one-time evaluation top-ups.",
  path: "/pricing",
}); }

export default function PricingPage() {
  return <PricingClient />;
}
