import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CREDIT_SESSION_COOKIE_NAME, verifyCreditSessionToken } from "../../../src/lib/creditSession";
import { labEmailAllowed } from "../../../src/lib/assignmentLab/access";
import { buildNoIndexMetadata } from "../../../src/lib/seo";
import { AssignmentLabClient } from "./AssignmentLabClient";

export const metadata: Metadata = buildNoIndexMetadata("Assignment revision lab", "Private assignment revision workspace.");
export const dynamic = "force-dynamic";

export default async function AssignmentLabPage() {
  const cookieStore = await cookies();
  let email: string | null = null;
  try { email = verifyCreditSessionToken(cookieStore.get(CREDIT_SESSION_COOKIE_NAME)?.value ?? "")?.email ?? null; } catch {}
  if (!email) return <main className="mx-auto max-w-xl px-6 py-24">
    <p className="text-sm font-semibold text-indigo-600">RubriCheck · Private lab</p>
    <h1 className="mt-4 text-3xl font-semibold">Log in to open your revision workspace</h1>
    <p className="mt-4 text-slate-600">Log in with your approved tester email on the home page, then return to this URL.</p>
    <Link href="/" className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white">Go to home page to log in</Link>
  </main>;
  if (!labEmailAllowed(email)) notFound();
  return <AssignmentLabClient />;
}

