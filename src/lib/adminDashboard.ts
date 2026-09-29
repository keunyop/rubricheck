import { FREE_TRIAL_LIMIT } from "../config/plans";
import { callSupabaseRpc, hasSupabaseConfig } from "./supabaseRest";

export type AdminSubscriberRow = {
  email: string | null;
  customerId: string | null;
  plan: "pro" | "topup" | "free";
  subscriptionStatus: "active" | "canceled" | "none";
  currentPeriodEnd: number | null;
  updatedAt: string | null;
  remainingCredits: number;
  freeEvaluationsUsed: number;
  freeEvaluationsRemaining: number;
  latestTopUpAt: string | null;
};

export type AdminDashboardData = {
  generatedAt: string;
  summary: {
    knownUsers: number;
    proUsers: number;
    topUpUsers: number;
    freeUsers: number;
    remainingCredits: number;
  };
  subscribers: AdminSubscriberRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function getAdminDashboardData(searchParams = new URLSearchParams()): Promise<AdminDashboardData> {
  const page = positiveInteger(searchParams.get("page"), 1, 2147483647);
  const pageSize = positiveInteger(searchParams.get("pageSize"), 25, 100);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 200);

  if (!hasSupabaseConfig()) {
    return {
      generatedAt: new Date().toISOString(),
      summary: { knownUsers: 0, proUsers: 0, topUpUsers: 0, freeUsers: 0, remainingCredits: 0 },
      subscribers: [],
      pagination: { page: 1, pageSize, total: 0, totalPages: 1 },
    };
  }

  return callSupabaseRpc<AdminDashboardData>("rubricheck_admin_dashboard", {
    p_page: page,
    p_page_size: pageSize,
    p_query: query,
    p_free_trial_limit: FREE_TRIAL_LIMIT,
  });
}
