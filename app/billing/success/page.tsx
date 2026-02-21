"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type RestoreStartResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type RestoreVerifyResponse = {
  ok?: boolean;
  plan?: string;
  status?: string;
  error?: string;
};

type Step = "email" | "code";

function isValidEmail(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function BillingSuccessPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/entitlement/restore/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data: RestoreStartResponse = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "ENTITLEMENT_RESTORE_START_FAILED");
      }

      setEmail(normalizedEmail);
      setStep("code");
      setInfo(data.message ?? "If that email can receive recovery codes, a code has been sent.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_RESTORE_START_FAILED";
      if (code === "RATE_LIMITED") {
        setError("Too many requests. Please wait and try again.");
      } else if (code === "SERVICE_UNAVAILABLE") {
        setError("Restore is temporarily unavailable. Please try again shortly.");
      } else {
        setError("Unable to send verification code right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email.");
      setStep("email");
      return;
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the 6-digit code.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/entitlement/restore/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });

      const data: RestoreVerifyResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "ENTITLEMENT_RESTORE_VERIFY_FAILED");
      }

      if (data.ok === true && data.plan === "pro" && data.status === "active") {
        setIsActivated(true);
        return;
      }

      setError("No active Pro subscription was found for this email.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "ENTITLEMENT_RESTORE_VERIFY_FAILED";
      if (code === "INVALID_CODE") {
        setError("Invalid or expired code. Please try again.");
      } else if (code === "RATE_LIMITED") {
        setError("Too many attempts. Please wait and try again.");
      } else if (code === "SERVICE_UNAVAILABLE") {
        setError("Restore is temporarily unavailable. Please try again shortly.");
      } else {
        setError("Unable to verify right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-20">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Payment successful</h1>
        <p className="mt-3 text-sm text-slate-600">
          Verify your checkout email to restore Pro on this device.
        </p>

        {step === "email" ? (
          <form className="mt-5 space-y-3" onSubmit={handleSendCode}>
            <label htmlFor="restore-email" className="block">
              <span className="text-xs font-semibold text-slate-700">Checkout email</span>
              <input
                id="restore-email"
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

            <button
              type="submit"
              disabled={isSubmitting || isActivated}
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send verification code"}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={handleVerify}>
            <label htmlFor="restore-code" className="block">
              <span className="text-xs font-semibold text-slate-700">Verification code</span>
              <input
                id="restore-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                disabled={isSubmitting || isActivated}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.2em] text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            {info ? (
              <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                {info}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            {isActivated ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Pro restored on this device.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setInfo("");
                }}
                disabled={isSubmitting || isActivated}
                className="inline-flex rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isActivated}
                className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Verifying..." : isActivated ? "Restored" : "Verify & Restore Pro"}
              </button>
            </div>
          </form>
        )}

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
