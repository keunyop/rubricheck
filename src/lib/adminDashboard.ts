import { FREE_TRIAL_LIMIT } from "../config/plans";
import { getAbuseMetrics } from "./abuseTelemetry";
import { hasSupabaseConfig, selectSupabaseRows } from "./supabaseRest";

type EntitlementRow = {
  customer_id?: unknown;
  email?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  updated_at?: unknown;
};

type CreditLotRow = {
  owner_type?: unknown;
  owner_id?: unknown;
  remaining_credits?: unknown;
};

type FreeUsageRow = {
  email?: unknown;
  evaluate_count?: unknown;
  updated_at?: unknown;
};

type CreditPaymentRow = {
  id?: unknown;
  owner_type?: unknown;
  owner_id?: unknown;
  stripe_customer_id?: unknown;
  purchaser_email?: unknown;
  credit_pack_id?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  total_credits?: unknown;
  created_at?: unknown;
};

type BillingWebhookFailureRow = {
  event_id?: unknown;
  event_type?: unknown;
  customer_id?: unknown;
  subscription_id?: unknown;
  session_id?: unknown;
  request_id?: unknown;
  error_message?: unknown;
  failed_at?: unknown;
};

export type AdminSubscriberRow = {
  email: string;
  customerId: string;
  status: "active" | "canceled";
  currentPeriodEnd: number;
  updatedAt: string | null;
  remainingCredits: number;
  freeEvaluationsUsed: number;
  freeEvaluationsRemaining: number;
  latestTopUpAt: string | null;
};

export type AdminPaymentRow = {
  id: number;
  ownerType: "customer" | "email";
  ownerId: string;
  customerId: string | null;
  purchaserEmail: string | null;
  creditPackId: string | null;
  credits: number;
  amountTotal: number | null;
  currency: string | null;
  createdAt: string | null;
};

export type AdminWebhookFailure = {
  eventId: string;
  eventType: string;
  customerId: string | null;
  subscriptionId: string | null;
  sessionId: string | null;
  requestId: string | null;
  errorMessage: string;
  failedAt: string | null;
};

export type AdminDashboardData = {
  generatedAt: string;
  summary: {
    activeSubscribers: number;
    inactiveSubscribers: number;
    trackedSubscribers: number;
    subscriberCredits: number;
    topUpCreditsSold30d: number;
    webhookFailures24h: number;
    suspiciousRequests1h: number;
    totalRequests1h: number;
  };
  abuse: {
    enforcementMode: "monitor" | "enforce";
    totalRequests1h: number;
    suspiciousRequests1h: number;
    errorRequests1h: number;
    totalRequests24h: number;
    suspiciousRequests24h: number;
    errorRequests24h: number;
  };
  subscribers: AdminSubscriberRow[];
  recentPayments: AdminPaymentRow[];
  recentWebhookFailures: AdminWebhookFailure[];
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
  }

  return 0;
}

function parseIsoString(value: unknown): string | null {
  return parseString(value);
}

function toOwnerKey(ownerType: "customer" | "email", ownerId: string): string {
  return `${ownerType}:${ownerType === "email" ? normalizeEmail(ownerId) : ownerId.trim()}`;
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function buildSubscriberRows(params: {
  entitlements: EntitlementRow[];
  lots: CreditLotRow[];
  freeUsageRows: FreeUsageRow[];
  payments: AdminPaymentRow[];
}): AdminSubscriberRow[] {
  const balanceByOwner = new Map<string, number>();
  for (const lot of params.lots) {
    const ownerType = lot.owner_type === "customer" || lot.owner_type === "email" ? lot.owner_type : null;
    const ownerId = parseString(lot.owner_id);
    if (!ownerType || !ownerId) {
      continue;
    }

    const current = balanceByOwner.get(toOwnerKey(ownerType, ownerId)) ?? 0;
    balanceByOwner.set(toOwnerKey(ownerType, ownerId), current + Math.max(0, parseNumber(lot.remaining_credits)));
  }

  const freeUsageByEmail = new Map<string, number>();
  for (const row of params.freeUsageRows) {
    const email = parseString(row.email);
    if (!email) {
      continue;
    }
    freeUsageByEmail.set(normalizeEmail(email), Math.max(0, parseNumber(row.evaluate_count)));
  }

  const latestPaymentByOwner = new Map<string, string>();
  for (const payment of params.payments) {
    if (!payment.createdAt) {
      continue;
    }
    const key = toOwnerKey(payment.ownerType, payment.ownerId);
    const current = latestPaymentByOwner.get(key);
    if (!current || payment.createdAt > current) {
      latestPaymentByOwner.set(key, payment.createdAt);
    }
  }

  return params.entitlements
    .map((row) => {
      const customerId = parseString(row.customer_id);
      const email = parseString(row.email);
      const status = row.status === "active" || row.status === "canceled" ? row.status : null;
      const currentPeriodEnd = Math.max(0, parseNumber(row.current_period_end));
      if (!customerId || !email || !status) {
        return null;
      }

      const normalizedEmail = normalizeEmail(email);
      return {
        email: normalizedEmail,
        customerId,
        status,
        currentPeriodEnd,
        updatedAt: parseIsoString(row.updated_at),
        remainingCredits:
          (balanceByOwner.get(toOwnerKey("customer", customerId)) ?? 0) +
          (balanceByOwner.get(toOwnerKey("email", normalizedEmail)) ?? 0),
        freeEvaluationsUsed: freeUsageByEmail.get(normalizedEmail) ?? 0,
        freeEvaluationsRemaining: Math.max(0, FREE_TRIAL_LIMIT - (freeUsageByEmail.get(normalizedEmail) ?? 0)),
        latestTopUpAt:
          latestPaymentByOwner.get(toOwnerKey("customer", customerId)) ??
          latestPaymentByOwner.get(toOwnerKey("email", normalizedEmail)) ??
          null,
      } satisfies AdminSubscriberRow;
    })
    .filter((row): row is AdminSubscriberRow => Boolean(row))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      return b.currentPeriodEnd - a.currentPeriodEnd;
    });
}

function parsePaymentRows(rows: CreditPaymentRow[]): AdminPaymentRow[] {
  return rows
    .map((row) => {
      const id = parseNumber(row.id);
      const ownerType = row.owner_type === "customer" || row.owner_type === "email" ? row.owner_type : null;
      const ownerId = parseString(row.owner_id);
      if (id <= 0 || !ownerType || !ownerId) {
        return null;
      }

      const amountTotal = row.amount_total === null || row.amount_total === undefined ? null : Math.max(0, parseNumber(row.amount_total));
      return {
        id,
        ownerType,
        ownerId: ownerType === "email" ? normalizeEmail(ownerId) : ownerId,
        customerId: parseString(row.stripe_customer_id),
        purchaserEmail: parseString(row.purchaser_email)?.toLowerCase() ?? null,
        creditPackId: parseString(row.credit_pack_id),
        credits: Math.max(0, parseNumber(row.total_credits)),
        amountTotal,
        currency: parseString(row.currency)?.toLowerCase() ?? null,
        createdAt: parseIsoString(row.created_at),
      } satisfies AdminPaymentRow;
    })
    .filter((row): row is AdminPaymentRow => Boolean(row));
}

function parseWebhookFailures(rows: BillingWebhookFailureRow[]): AdminWebhookFailure[] {
  return rows
    .map((row) => {
      const eventId = parseString(row.event_id);
      const eventType = parseString(row.event_type);
      const errorMessage = parseString(row.error_message);
      if (!eventId || !eventType || !errorMessage) {
        return null;
      }

      return {
        eventId,
        eventType,
        customerId: parseString(row.customer_id),
        subscriptionId: parseString(row.subscription_id),
        sessionId: parseString(row.session_id),
        requestId: parseString(row.request_id),
        errorMessage,
        failedAt: parseIsoString(row.failed_at),
      } satisfies AdminWebhookFailure;
    })
    .filter((row): row is AdminWebhookFailure => Boolean(row));
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const generatedAt = new Date().toISOString();
  const abuseMetrics = await getAbuseMetrics();
  const totalRequests1h = sumRecord(abuseMetrics.last1h.totalRequestsByEndpoint);
  const suspiciousRequests1h = sumRecord(abuseMetrics.last1h.suspiciousRequestsByEndpoint);
  const errorRequests1h = sumRecord(abuseMetrics.last1h.errorRequestsByEndpoint);
  const totalRequests24h = sumRecord(abuseMetrics.last24h.totalRequestsByEndpoint);
  const suspiciousRequests24h = sumRecord(abuseMetrics.last24h.suspiciousRequestsByEndpoint);
  const errorRequests24h = sumRecord(abuseMetrics.last24h.errorRequestsByEndpoint);

  if (!hasSupabaseConfig()) {
    return {
      generatedAt,
      summary: {
        activeSubscribers: 0,
        inactiveSubscribers: 0,
        trackedSubscribers: 0,
        subscriberCredits: 0,
        topUpCreditsSold30d: 0,
        webhookFailures24h: 0,
        suspiciousRequests1h,
        totalRequests1h,
      },
      abuse: {
        enforcementMode: abuseMetrics.enforcementMode,
        totalRequests1h,
        suspiciousRequests1h,
        errorRequests1h,
        totalRequests24h,
        suspiciousRequests24h,
        errorRequests24h,
      },
      subscribers: [],
      recentPayments: [],
      recentWebhookFailures: [],
    };
  }

  const [entitlements, lots, freeUsageRows, paymentRows, webhookFailureRows] = await Promise.all([
    selectSupabaseRows<EntitlementRow>({
      table: "account_entitlements",
      select: "customer_id,email,status,current_period_end,updated_at",
      orderBy: { column: "updated_at", ascending: false },
      limit: 250,
    }),
    selectSupabaseRows<CreditLotRow>({
      table: "credit_lots",
      select: "owner_type,owner_id,remaining_credits",
      limit: 5000,
    }),
    selectSupabaseRows<FreeUsageRow>({
      table: "free_usage_counters",
      select: "email,evaluate_count,updated_at",
      orderBy: { column: "updated_at", ascending: false },
      limit: 1000,
    }),
    selectSupabaseRows<CreditPaymentRow>({
      table: "credit_payments",
      select: "id,owner_type,owner_id,stripe_customer_id,purchaser_email,credit_pack_id,amount_total,currency,total_credits,created_at",
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
    }),
    selectSupabaseRows<BillingWebhookFailureRow>({
      table: "billing_webhook_failures",
      select: "event_id,event_type,customer_id,subscription_id,session_id,request_id,error_message,failed_at",
      orderBy: { column: "failed_at", ascending: false },
      limit: 30,
    }),
  ]);

  const recentPayments = parsePaymentRows(paymentRows);
  const recentWebhookFailures = parseWebhookFailures(webhookFailureRows);
  const subscribers = buildSubscriberRows({
    entitlements,
    lots,
    freeUsageRows,
    payments: recentPayments,
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const activeSubscribers = subscribers.filter(
    (row) => row.status === "active" && row.currentPeriodEnd >= nowSeconds,
  ).length;
  const inactiveSubscribers = subscribers.length - activeSubscribers;
  const subscriberCredits = subscribers.reduce((sum, row) => sum + row.remainingCredits, 0);
  const thirtyDaysAgoIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const topUpCreditsSold30d = recentPayments.reduce((sum, row) => {
    if (!row.createdAt || row.createdAt < thirtyDaysAgoIso) {
      return sum;
    }
    return sum + row.credits;
  }, 0);
  const twentyFourHoursAgoIso = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const webhookFailures24h = recentWebhookFailures.filter((row) => row.failedAt && row.failedAt >= twentyFourHoursAgoIso).length;

  return {
    generatedAt,
    summary: {
      activeSubscribers,
      inactiveSubscribers,
      trackedSubscribers: subscribers.length,
      subscriberCredits,
      topUpCreditsSold30d,
      webhookFailures24h,
      suspiciousRequests1h,
      totalRequests1h,
    },
    abuse: {
      enforcementMode: abuseMetrics.enforcementMode,
      totalRequests1h,
      suspiciousRequests1h,
      errorRequests1h,
      totalRequests24h,
      suspiciousRequests24h,
      errorRequests24h,
    },
    subscribers,
    recentPayments,
    recentWebhookFailures,
  };
}
