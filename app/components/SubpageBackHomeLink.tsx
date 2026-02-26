import Link from "next/link";

type SubpageBackHomeLinkProps = {
  className?: string;
};

export function SubpageBackHomeLink({ className }: SubpageBackHomeLinkProps) {
  return (
    <Link href="/" className={className ?? "text-sm font-medium text-indigo-700 transition hover:text-indigo-600"}>
      {"<- Back to home"}
    </Link>
  );
}
