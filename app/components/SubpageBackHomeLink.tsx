"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubpageBackHomeLink() {
  const pathname = usePathname();

  if (!pathname || pathname === "/") {
    return null;
  }

  return (
    <div className="fixed left-4 top-4 z-40">
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-400 hover:text-slate-900"
      >
        &lt;- Back to Home
      </Link>
    </div>
  );
}
