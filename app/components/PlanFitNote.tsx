"use client";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { getCreditPackPriceLabel } from "../../src/config/creditPacks";
import { PRO_CHECKOUT_DISPLAY } from "../../src/config/proCheckout";

export function PlanFitNote({ evaluationId, onChoose }: { evaluationId?: string; onChoose?: (tab: "pro" | "topups") => void }) {
  const {t,href}=useLanguage();
  if (process.env.NEXT_PUBLIC_GROWTH_POSITIONING_ENABLED === "false") return null;
  const choices = [
    {tab:"topups" as const,title:"Occasional assignment checks",price:getCreditPackPriceLabel("10"),detail:"10 evaluations. One-time payment, no subscription. Full criterion feedback and Strict mode; rewrites require Pro."},
    {tab:"pro" as const,title:"Frequent checks and revisions",price:PRO_CHECKOUT_DISPLAY.monthly.price+t("/month"),detail:"Pro includes unlimited evaluations, full criterion feedback, Strict mode and rewrite suggestions. Monthly, annual and Lifetime options."},
  ];
  return <aside aria-label={t("Choose how you use RubriCheck")} className="mt-4 grid gap-3 sm:grid-cols-2">
    {choices.map(c=><div key={c.tab} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
      <p className="font-semibold text-slate-900">{t(c.title)} · {c.price}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{t(c.detail)}</p>
      {onChoose ? <button type="button" onClick={()=>onChoose(c.tab)} className="mt-2 font-medium text-indigo-700 underline">{t(c.tab==="topups"?"Compare credit packs":"Compare Pro options")}</button> : <Link className="mt-2 inline-block font-medium text-indigo-700 underline" href={href(`/pricing?tab=${c.tab}${evaluationId?`&evaluation_id=${encodeURIComponent(evaluationId)}`:""}`)}>{t(c.tab==="topups"?"Compare credit packs":"Compare Pro options")}</Link>}
    </div>)}
  </aside>;
}
