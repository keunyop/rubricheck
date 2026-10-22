"use client";
import { useLanguage } from "./LanguageProvider";
import { usePathname } from "next/navigation";
import { stripLocale } from "../../src/i18n/config";
import Link from "next/link";

type SubpageBackHomeLinkProps = {
  className?: string;
};

export function SubpageBackHomeLink({ className }: SubpageBackHomeLinkProps) {
  const { t, href } = useLanguage();
  const path = stripLocale(usePathname());
  const toWorkspace = path === "/pricing" || path.startsWith("/billing/") || path.startsWith("/admin");
  return (
    <Link href={href(toWorkspace ? "/workspace" : "/")} className={className ?? "text-sm font-medium text-indigo-700 transition hover:text-indigo-600"}>
      {t(toWorkspace ? "<- Back to workspace" : "<- Back to home")}
    </Link>
  );
}
