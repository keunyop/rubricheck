import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "../../../src/i18n/config";

// Explicit public route aliases keep the existing routes and API paths stable.
// Real routes also avoid an extra HTTP hop when a proxy normalizes the host.
const pages = {
  "/": () => import("../../page"),
  "/pricing": () => import("../../pricing/page"),
  "/rubric-checker": () => import("../../rubric-checker/page"),
  "/ai-rubric-grader": () => import("../../ai-rubric-grader/page"),
  "/assignment-rubric-checker": () => import("../../assignment-rubric-checker/page"),
  "/essay-rubric-checker": () => import("../../essay-rubric-checker/page"),
  "/rubric-feedback-tool": () => import("../../rubric-feedback-tool/page"),
  "/how-to-use-a-rubric-to-check-an-assignment": () => import("../../how-to-use-a-rubric-to-check-an-assignment/page"),
  "/legal/privacy": () => import("../../legal/privacy/page"),
  "/legal/terms": () => import("../../legal/terms/page"),
  "/legal/refund-policy": () => import("../../legal/refund-policy/page"),
  "/legal/ai-disclaimer": () => import("../../legal/ai-disclaimer/page"),
  "/legal/data-retention": () => import("../../legal/data-retention/page"),
};
type Props = { params: Promise<{ locale: string; slug?: string[] }> };
async function resolvePage(props: Props) {
  const { locale, slug } = await props.params;
  const path = "/" + (slug ?? []).join("/");
  if (!isLocale(locale) || locale === "en" || !Object.hasOwn(pages, path)) notFound();
  return pages[path as keyof typeof pages]();
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  return (await resolvePage(props)).generateMetadata();
}
export default async function LocalizedPage(props: Props) {
  const Page = (await resolvePage(props)).default;
  return <Page />;
}
