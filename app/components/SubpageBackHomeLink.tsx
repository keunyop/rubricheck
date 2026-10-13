"use client";
import { useLanguage } from "./LanguageProvider";
import Link from "next/link";

type SubpageBackHomeLinkProps = {
  className?: string;
};

export function SubpageBackHomeLink({ className }: SubpageBackHomeLinkProps) {
  const { t, href } = useLanguage();
  return (
    <Link href={href("/")} className={className ?? "text-sm font-medium text-indigo-700 transition hover:text-indigo-600"}>
      {t("<- Back to home")}
    </Link>
  );
}
