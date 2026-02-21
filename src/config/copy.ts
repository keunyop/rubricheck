export const LANDING_COPY = {
  headline: "RubriCheck",
  subtitle: {
    A: "Get calm, rubric-aligned feedback before you submit so you can revise with confidence.",
    B: "Build pre-submission confidence with a quick rubric check and clear next steps.",
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
