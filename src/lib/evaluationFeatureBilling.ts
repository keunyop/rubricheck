export type UsageFeature = "evaluate" | "rewrite";

export function canUseCreditsForFeature(feature: UsageFeature): boolean {
  return feature === "evaluate";
}
