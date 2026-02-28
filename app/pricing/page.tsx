import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PricingClient } from "./PricingClient";

const IS_PRODUCTION_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() === "production";

export const metadata: Metadata = {
  title: "Pricing",
  description: "RubriCheck pricing for Pro plans and one-time evaluation top-ups.",
};

export default function PricingPage() {
  if (IS_PRODUCTION_APP_ENV) {
    notFound();
  }

  return <PricingClient />;
}
