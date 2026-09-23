export const LANDING_COPY = {
  headline: "Rubric Checker for Essays and Assignments",
  subtitle: {
    A: "Add your rubric and draft. See estimated scores and what to improve before you submit.",
    B: "Check your draft against the rubric and find your next revision priorities.",
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
