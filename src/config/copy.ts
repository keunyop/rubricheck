export const LANDING_COPY = {
  headline: "AI Rubric Grader for Assignment Draft Feedback",
  subtitle: {
    A: "Check essays and assignments against your rubric before submission with criterion-level feedback, score ranges, and clear revision guidance.",
    B: "Run a quick rubric check on your draft and get focused feedback before you submit.",
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
