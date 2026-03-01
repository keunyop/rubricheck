"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type AccountPlan = "free" | "pro";

type AccountSummaryResponse = {
  signedIn?: boolean;
  email?: string | null;
  plan?: AccountPlan;
  remainingEvaluations?: number | null;
  creditsBalance?: number | null;
};

type AccountSummaryState = {
  signedInEmail: string;
  accountPlan: AccountPlan;
  remainingEvaluations: number | null;
  creditBalance: number | null;
  hasLoadedAccountSummary: boolean;
  refreshAccountSummary: () => Promise<void>;
  clearAccountSummary: () => void;
};

const AccountSummaryContext = createContext<AccountSummaryState | null>(null);

function normalizeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

export function AccountSummaryProvider({ children }: { children: ReactNode }) {
  const [signedInEmail, setSignedInEmail] = useState("");
  const [accountPlan, setAccountPlan] = useState<AccountPlan>("free");
  const [remainingEvaluations, setRemainingEvaluations] = useState<number | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [hasLoadedAccountSummary, setHasLoadedAccountSummary] = useState(false);
  const didRunInitialFetchRef = useRef(false);

  const applySignedOutSummary = useCallback(() => {
    setSignedInEmail("");
    setAccountPlan("free");
    setRemainingEvaluations(null);
    setCreditBalance(null);
    setHasLoadedAccountSummary(true);
  }, []);

  const refreshAccountSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/account/summary", {
        method: "GET",
        cache: "no-store",
      });
      const data: AccountSummaryResponse = await response.json().catch(() => ({}));
      const email = typeof data.email === "string" ? data.email.trim() : "";
      const remaining = normalizeCount(data.remainingEvaluations);
      const balance = normalizeCount(data.creditsBalance);

      if (response.ok && data.signedIn && email) {
        setSignedInEmail(email);
        setAccountPlan(data.plan === "pro" ? "pro" : "free");
        setRemainingEvaluations(remaining);
        setCreditBalance(balance);
        setHasLoadedAccountSummary(true);
        return;
      }

      applySignedOutSummary();
    } catch {
      applySignedOutSummary();
    }
  }, [applySignedOutSummary]);

  useEffect(() => {
    if (didRunInitialFetchRef.current) {
      return;
    }

    didRunInitialFetchRef.current = true;
    const timer = window.setTimeout(() => {
      void refreshAccountSummary();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshAccountSummary]);

  const clearAccountSummary = useCallback(() => {
    applySignedOutSummary();
  }, [applySignedOutSummary]);

  return (
    <AccountSummaryContext.Provider
      value={{
        signedInEmail,
        accountPlan,
        remainingEvaluations,
        creditBalance,
        hasLoadedAccountSummary,
        refreshAccountSummary,
        clearAccountSummary,
      }}
    >
      {children}
    </AccountSummaryContext.Provider>
  );
}

export function useAccountSummary(): AccountSummaryState {
  const context = useContext(AccountSummaryContext);
  if (!context) {
    throw new Error("useAccountSummary must be used within AccountSummaryProvider");
  }

  return context;
}
