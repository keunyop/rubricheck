"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SubpageBackHomeLink } from "../../components/SubpageBackHomeLink";

type RestoreStartResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  error?: string;
};

type RestoreVerifyResponse = {
  ok?: boolean;
  plan?: string;
  status?: string;
  code?: string;
  message?: string;
  error?: string;
};

type CheckoutActivateResponse = {
  ok?: boolean;
  plan?: string;
  status?: string;
  code?: string;
  message?: string;
  error?: string;
};

type Step = "email" | "code";

function isValidEmail(email: string): boolean {
  if (!email || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function BillingSuccessClient() {
  const searchParams = useSearchParams();
  const checkoutSessionId = searchParams.get("session_id")?.trim() ?? "";
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [isAutoActivating, setIsAutoActivating] = useState(Boolean(checkoutSessionId));
  const [didTryAutoActivation, setDidTryAutoActivation] = useState(false);

  useEffect(() => {
    if (!checkoutSessionId) {
      setIsAutoActivating(false);
      setDidTryAutoActivation(true);
      return;
    }

    let cancelled = false;

    async function activateFromCheckoutSession() {
      setError("");
      setInfo("Activating your Pro access...");
      setIsActivating(true);
      setIsAutoActivating(true);

      try {
        const response = await fetch("/api/checkout/activate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: checkoutSessionId }),
        });

        const data: CheckoutActivateResponse = await response.json().catch(() => ({}));
        if (cancelled) {
          return;
        }

        if (response.ok && data.ok === true && data.plan === "pro" && data.status === "active") {
          setIsActivated(true);
          setIsActivating(false);
          setInfo("Pro is now active on this device.");
          return;
        }

        if (response.ok && data.ok === false && data.status === "pending") {
          setIsActivating(true);
          setInfo("Payment received. Activation is still processing, so you can verify by email below.");
          return;
        }

        setIsActivating(false);
        setInfo("");
        setError("Automatic activation was unavailable. Verify your checkout email below.");
      } catch {
        if (cancelled) {
          return;
        }

        setIsActivating(false);
        setInfo("");
        setError("Automatic activation failed. Verify your checkout email below.");
      } finally {
        if (!cancelled) {
          setIsAutoActivating(false);
          setDidTryAutoActivation(true);
        }
      }
    }

    void activateFromCheckoutSession();

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId]);

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
        throw new Error(data.error ?? data.code ?? "ENTITLEMENT_RESTORE_START_FAILED");
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
        throw new Error(data.error ?? data.code ?? "ENTITLEMENT_RESTORE_VERIFY_FAILED");
      }

      if (data.ok === true && data.plan === "pro" && data.status === "active") {
        setIsActivated(true);
        setIsActivating(false);
        return;
      }

      setIsActivating(true);
      setError("Payment received - activating your Pro access. Use Refresh or log in again in a moment.");
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
        <SubpageBackHomeLink />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Payment successful</h1>
        <p className="mt-3 text-sm text-slate-600">
          {checkoutSessionId
            ? "We're activating your Pro access on this device automatically."
            : "Verify your checkout email to log in on this device."}
        </p>

        {isAutoActivating ? (
          <p className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            Processing your checkout session...
          </p>
        ) : null}

        {isActivated ? (
          <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Pro is active on this device. You can go back and continue using Pro features.
          </p>
        ) : null}

        {step === "email" && (!checkoutSessionId || didTryAutoActivation) && !isActivated ? (
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
                disabled={isSubmitting || isActivated || isAutoActivating}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || isActivated || isAutoActivating}
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send verification code"}
            </button>
          </form>
        ) : !isAutoActivating && !isActivated ? (
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
                disabled={isSubmitting || isActivated || isAutoActivating}
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
                You are now logged in on this device.
              </p>
            ) : null}

            {isActivating ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Payment received - activating. If this takes longer than expected, tap Verify &amp; Log in again.
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
                disabled={isSubmitting || isActivated || isAutoActivating}
                className="inline-flex rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isActivated || isAutoActivating}
                className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Verifying..." : isActivated ? "Logged in" : "Verify & Log in"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-20">
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <SubpageBackHomeLink />
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Payment successful</h1>
            <p className="mt-3 text-sm text-slate-600">Loading checkout status...</p>
          </section>
        </main>
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
