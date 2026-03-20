import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../src/lib/seo";
import { BillingManageClient } from "./BillingManageClient";

export const metadata: Metadata = buildNoIndexMetadata(
  "Manage Billing",
  "Private billing management area for existing RubriCheck customers.",
);

export default function BillingManagePage() {
  return <BillingManageClient />;
}
