export const LANDING_COPY = {
  headline: "RubriCheck",
  subtitle: {
    A: "Upload your assignment and rubric to estimate likely scores, get criterion-level feedback, and revise before submission.",
    B: "Run a quick rubric check on assignment and essay drafts, then focus on the next changes most likely to improve your result.",
  },
} as const;

export type CopyVariant = keyof typeof LANDING_COPY.subtitle;

function resolveCopyVariant(rawVariant: string | undefined): CopyVariant {
  const normalized = rawVariant?.trim().toUpperCase();
  return normalized === "B" ? "B" : "A";
}

const activeCopyVariant = resolveCopyVariant(process.env.NEXT_PUBLIC_COPY_VARIANT);

export const ACTIVE_LANDING_COPY = {
  headline: LANDING_COPY.headline,
  subtitle: LANDING_COPY.subtitle[activeCopyVariant],
  variant: activeCopyVariant,
} as const;
