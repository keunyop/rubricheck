type AccountStatusPillProps = {
  plan: "free" | "pro";
  remainingEvaluations: number | null;
};

export function AccountStatusPill({ plan, remainingEvaluations }: AccountStatusPillProps) {
  if (plan === "pro") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98),rgba(224,242,254,0.96))] px-1.5 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.65)] ring-1 ring-white/70"
        aria-label="Pro account with unlimited evaluations"
      >
        <span className="inline-flex items-center rounded-full bg-slate-950 px-2 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200">
          Pro
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cyan-100 text-[16px] font-black leading-none text-cyan-700">
            &infin;
          </span>
          <span className="whitespace-nowrap">evaluations left</span>
        </span>
      </span>
    );
  }

  if (typeof remainingEvaluations === "number") {
    if (remainingEvaluations <= 0) {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          No free evaluations left
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
        {remainingEvaluations} evaluations left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      Remaining evaluations -
    </span>
  );
}
