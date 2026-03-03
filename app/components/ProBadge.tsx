type ProBadgeProps = {
  className?: string;
};

const BASE_CLASS_NAME =
  "inline-flex items-center rounded-full bg-slate-950 px-2 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200";

export function ProBadge({ className = "" }: ProBadgeProps) {
  return <span className={className ? `${BASE_CLASS_NAME} ${className}` : BASE_CLASS_NAME}>Pro</span>;
}
