"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type EntitlementApiResponse = {
  ok?: boolean;
  plan?: string;
  error?: string;
};

function isValidEmail(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function BillingSuccessPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [error, setError] = useState("");

  async function handleActivatePro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/entitlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data: EntitlementApiResponse = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true || data.plan !== "pro") {
        throw new Error(data.error ?? "ENTITLEMENT_ACTIVATION_FAILED");
      }

      setIsActivated(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_ACTIVATION_FAILED";
      setError(`Activation failed (${code}). Please use the same email you used at checkout.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Payment successful</h1>
        <p className="mt-3 text-sm text-slate-600">
          Enter the same email used at checkout to activate Pro on this device.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleActivatePro}>
          <label htmlFor="activate-pro-email" className="block">
            <span className="text-xs font-semibold text-slate-700">Checkout email</span>
            <input
              id="activate-pro-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              disabled={isSubmitting || isActivated}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          {isActivated ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Pro activated on this device.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || isActivated}
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Activating..." : isActivated ? "Activated" : "Activate Pro"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
        >
          Back to RubriCheck
        </Link>
      </section>
    </main>
  );
}
