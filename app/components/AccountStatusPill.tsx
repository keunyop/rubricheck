"use client";
import { useLanguage } from "./LanguageProvider";
import { ProBadge } from "./ProBadge";
import type { AccountFeatureTier } from "../../src/lib/accountFeatureAccess";

type AccountStatusPillProps = {
  plan: AccountFeatureTier;
  remainingEvaluations: number | null;
};

export function AccountStatusPill({ plan, remainingEvaluations }: AccountStatusPillProps) {
  const { t } = useLanguage();
  if (plan === "pro") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98),rgba(224,242,254,0.96))] px-1.5 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.65)] ring-1 ring-white/70"
        aria-label={t("Pro account with unlimited evaluations")}
      >
        <ProBadge />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cyan-100 text-[16px] font-black leading-none text-cyan-700">
            &infin;
          </span>
          <span className="whitespace-nowrap">{t("evaluations left")}</span>
        </span>
      </span>
    );
  }

  if (plan === "topup") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <span className="whitespace-nowrap">{t("Top-up")}</span>
        <span className="text-emerald-300">•</span>
        <span className="whitespace-nowrap">
          {typeof remainingEvaluations === "number" ? t("{count} evaluations left", { count: remainingEvaluations }) : t("credits active")}
        </span>
      </span>
    );
  }

  if (typeof remainingEvaluations === "number") {
    if (remainingEvaluations <= 0) {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"> {t("No free evaluations left")} </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
        {t("{count} evaluations left", { count: remainingEvaluations })} </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"> {t("Remaining evaluations -")} </span>
  );
}
