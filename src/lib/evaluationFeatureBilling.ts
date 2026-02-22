export type UsageFeature = "evaluate" | "rewrite" | "simulate";

export function canUseCreditsForFeature(feature: UsageFeature): boolean {
  return feature === "evaluate";
}
