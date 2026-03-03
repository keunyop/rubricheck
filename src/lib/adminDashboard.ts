import { FREE_TRIAL_LIMIT } from "../config/plans";
import { hasSupabaseConfig, selectAllSupabaseRows } from "./supabaseRest";

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
  created_at?: unknown;
};

type FreeUsageRow = {
  email?: unknown;
  evaluate_count?: unknown;
};

type CreditPaymentRow = {
  owner_type?: unknown;
  owner_id?: unknown;
  stripe_customer_id?: unknown;
  purchaser_email?: unknown;
  created_at?: unknown;
};

type ParsedEntitlement = {
  customerId: string;
  email: string;
  status: "active" | "canceled";
  currentPeriodEnd: number;
  updatedAt: string | null;
};

type ParsedPayment = {
  ownerType: "customer" | "email";
  ownerId: string;
  customerId: string | null;
  purchaserEmail: string | null;
  createdAt: string | null;
};

type MutableSubscriber = {
  email: string | null;
  customerId: string | null;
  subscriptionStatus: "active" | "canceled" | "none";
  currentPeriodEnd: number | null;
  updatedAt: string | null;
  remainingCredits: number;
  freeEvaluationsUsed: number;
  latestTopUpAt: string | null;
};

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

function getIdentityKey(email: string | null, customerId: string | null): string | null {
  if (email) {
    return `email:${normalizeEmail(email)}`;
  }

  if (customerId) {
    return `customer:${customerId.trim()}`;
  }

  return null;
}

function pickLatestIso(first: string | null, second: string | null): string | null {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return first >= second ? first : second;
}

function mergeSubscribers(target: MutableSubscriber, source: MutableSubscriber): MutableSubscriber {
  const currentPeriodEnd = Math.max(target.currentPeriodEnd ?? 0, source.currentPeriodEnd ?? 0);
  let subscriptionStatus: MutableSubscriber["subscriptionStatus"] = "none";
  if (target.subscriptionStatus === "active" || source.subscriptionStatus === "active") {
    subscriptionStatus = "active";
  } else if (target.subscriptionStatus === "canceled" || source.subscriptionStatus === "canceled") {
    subscriptionStatus = "canceled";
  }

  return {
    email: target.email ?? source.email,
    customerId: target.customerId ?? source.customerId,
    subscriptionStatus,
    currentPeriodEnd: currentPeriodEnd > 0 ? currentPeriodEnd : null,
    updatedAt: pickLatestIso(target.updatedAt, source.updatedAt),
    remainingCredits: target.remainingCredits + source.remainingCredits,
    freeEvaluationsUsed: Math.max(target.freeEvaluationsUsed, source.freeEvaluationsUsed),
    latestTopUpAt: pickLatestIso(target.latestTopUpAt, source.latestTopUpAt),
  };
}

function ensureSubscriber(
  subscribers: Map<string, MutableSubscriber>,
  email: string | null,
  customerId: string | null,
): MutableSubscriber | null {
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const normalizedCustomerId = customerId?.trim() || null;
  const emailKey = getIdentityKey(normalizedEmail, null);
  const customerKey = getIdentityKey(null, normalizedCustomerId);

  let subscriber =
    (emailKey ? subscribers.get(emailKey) : undefined) ??
    (customerKey ? subscribers.get(customerKey) : undefined) ??
    null;

  if (!subscriber) {
    subscriber = {
      email: normalizedEmail,
      customerId: normalizedCustomerId,
      subscriptionStatus: "none",
      currentPeriodEnd: null,
      updatedAt: null,
      remainingCredits: 0,
      freeEvaluationsUsed: 0,
      latestTopUpAt: null,
    };
  }

  if (normalizedEmail) {
    subscriber.email = normalizedEmail;
  }
  if (normalizedCustomerId) {
    subscriber.customerId = normalizedCustomerId;
  }

  if (emailKey) {
    const existingEmailSubscriber = subscribers.get(emailKey);
    if (existingEmailSubscriber && existingEmailSubscriber !== subscriber) {
      subscriber = mergeSubscribers(existingEmailSubscriber, subscriber);
    }
    subscribers.set(emailKey, subscriber);
  }

  if (customerKey) {
    const existingCustomerSubscriber = subscribers.get(customerKey);
    if (existingCustomerSubscriber && existingCustomerSubscriber !== subscriber) {
      subscriber = mergeSubscribers(existingCustomerSubscriber, subscriber);
    }
    subscribers.set(customerKey, subscriber);
  }

  if (emailKey) {
    subscribers.set(emailKey, subscriber);
  }
  if (customerKey) {
    subscribers.set(customerKey, subscriber);
  }

  return subscriber;
}

function parseEntitlements(rows: EntitlementRow[]): ParsedEntitlement[] {
  return rows
    .map((row) => {
      const customerId = parseString(row.customer_id);
      const email = parseString(row.email);
      const status = row.status === "active" || row.status === "canceled" ? row.status : null;
      if (!customerId || !email || !status) {
        return null;
      }

      return {
        customerId: customerId.trim(),
        email: normalizeEmail(email),
        status,
        currentPeriodEnd: Math.max(0, parseNumber(row.current_period_end)),
        updatedAt: parseIsoString(row.updated_at),
      } satisfies ParsedEntitlement;
    })
    .filter((row): row is ParsedEntitlement => Boolean(row));
}

function parsePayments(rows: CreditPaymentRow[]): ParsedPayment[] {
  return rows
    .map((row) => {
      const ownerType = row.owner_type === "customer" || row.owner_type === "email" ? row.owner_type : null;
      const ownerId = parseString(row.owner_id);
      if (!ownerType || !ownerId) {
        return null;
      }

      return {
        ownerType,
        ownerId: ownerType === "email" ? normalizeEmail(ownerId) : ownerId.trim(),
        customerId: parseString(row.stripe_customer_id),
        purchaserEmail: parseString(row.purchaser_email)?.toLowerCase() ?? null,
        createdAt: parseIsoString(row.created_at),
      } satisfies ParsedPayment;
    })
    .filter((row): row is ParsedPayment => Boolean(row));
}

function resolvePlan(row: MutableSubscriber, nowSeconds: number): AdminSubscriberRow["plan"] {
  if (row.subscriptionStatus === "active" && (row.currentPeriodEnd ?? 0) >= nowSeconds) {
    return "pro";
  }

  if (row.remainingCredits > 0) {
    return "topup";
  }

  return "free";
}

function buildSubscriberRows(params: {
  entitlements: ParsedEntitlement[];
  lots: CreditLotRow[];
  freeUsageRows: FreeUsageRow[];
  payments: ParsedPayment[];
}): AdminSubscriberRow[] {
  const subscribers = new Map<string, MutableSubscriber>();
  const emailByCustomerId = new Map<string, string>();

  for (const entitlement of params.entitlements) {
    emailByCustomerId.set(entitlement.customerId, entitlement.email);
  }

  for (const payment of params.payments) {
    if (payment.customerId && payment.purchaserEmail) {
      emailByCustomerId.set(payment.customerId, payment.purchaserEmail);
    }
  }

  for (const entitlement of params.entitlements) {
    const subscriber = ensureSubscriber(subscribers, entitlement.email, entitlement.customerId);
    if (!subscriber) {
      continue;
    }

    subscriber.subscriptionStatus = entitlement.status;
    subscriber.currentPeriodEnd = entitlement.currentPeriodEnd;
    subscriber.updatedAt = pickLatestIso(subscriber.updatedAt, entitlement.updatedAt);
  }

  for (const row of params.freeUsageRows) {
    const email = parseString(row.email);
    if (!email) {
      continue;
    }

    const subscriber = ensureSubscriber(subscribers, email, null);
    if (!subscriber) {
      continue;
    }

    subscriber.freeEvaluationsUsed = Math.max(subscriber.freeEvaluationsUsed, Math.max(0, parseNumber(row.evaluate_count)));
  }

  for (const lot of params.lots) {
    const ownerType = lot.owner_type === "customer" || lot.owner_type === "email" ? lot.owner_type : null;
    const ownerId = parseString(lot.owner_id);
    if (!ownerType || !ownerId) {
      continue;
    }

    const normalizedOwnerId = ownerType === "email" ? normalizeEmail(ownerId) : ownerId.trim();
    const email = ownerType === "email" ? normalizedOwnerId : (emailByCustomerId.get(normalizedOwnerId) ?? null);
    const customerId = ownerType === "customer" ? normalizedOwnerId : null;
    const subscriber = ensureSubscriber(subscribers, email, customerId);
    if (!subscriber) {
      continue;
    }

    subscriber.remainingCredits += Math.max(0, parseNumber(lot.remaining_credits));
    subscriber.latestTopUpAt = pickLatestIso(subscriber.latestTopUpAt, parseIsoString(lot.created_at));
  }

  for (const payment of params.payments) {
    const email = payment.ownerType === "email" ? payment.ownerId : (payment.purchaserEmail ?? emailByCustomerId.get(payment.ownerId) ?? null);
    const customerId = payment.ownerType === "customer" ? payment.ownerId : payment.customerId;
    const subscriber = ensureSubscriber(subscribers, email, customerId ?? null);
    if (!subscriber) {
      continue;
    }

    subscriber.latestTopUpAt = pickLatestIso(subscriber.latestTopUpAt, payment.createdAt);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const dedupedSubscribers = Array.from(new Set(subscribers.values()));

  return dedupedSubscribers
    .map((row) => ({
      email: row.email,
      customerId: row.customerId,
      plan: resolvePlan(row, nowSeconds),
      subscriptionStatus: row.subscriptionStatus,
      currentPeriodEnd: row.currentPeriodEnd,
      updatedAt: row.updatedAt,
      remainingCredits: row.remainingCredits,
      freeEvaluationsUsed: row.freeEvaluationsUsed,
      freeEvaluationsRemaining: Math.max(0, FREE_TRIAL_LIMIT - row.freeEvaluationsUsed),
      latestTopUpAt: row.latestTopUpAt,
    }))
    .sort((a, b) => {
      const planRank = { pro: 0, topup: 1, free: 2 } as const;
      if (planRank[a.plan] !== planRank[b.plan]) {
        return planRank[a.plan] - planRank[b.plan];
      }

      const latestA = a.latestTopUpAt ?? a.updatedAt ?? "";
      const latestB = b.latestTopUpAt ?? b.updatedAt ?? "";
      if (latestA !== latestB) {
        return latestB.localeCompare(latestA);
      }

      const labelA = a.email ?? a.customerId ?? "";
      const labelB = b.email ?? b.customerId ?? "";
      return labelA.localeCompare(labelB);
    });
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const generatedAt = new Date().toISOString();

  if (!hasSupabaseConfig()) {
    return {
      generatedAt,
      summary: {
        knownUsers: 0,
        proUsers: 0,
        topUpUsers: 0,
        freeUsers: 0,
        remainingCredits: 0,
      },
      subscribers: [],
    };
  }

  const [entitlementRows, lotRows, freeUsageRows, paymentRows] = await Promise.all([
    selectAllSupabaseRows<EntitlementRow>({
      table: "account_entitlements",
      select: "customer_id,email,status,current_period_end,updated_at",
      orderBy: { column: "updated_at", ascending: false },
      pageSize: 1000,
    }),
    selectAllSupabaseRows<CreditLotRow>({
      table: "credit_lots",
      select: "owner_type,owner_id,remaining_credits,created_at",
      orderBy: { column: "created_at", ascending: false },
      pageSize: 1000,
    }),
    selectAllSupabaseRows<FreeUsageRow>({
      table: "free_usage_counters",
      select: "email,evaluate_count",
      orderBy: { column: "updated_at", ascending: false },
      pageSize: 1000,
    }),
    selectAllSupabaseRows<CreditPaymentRow>({
      table: "credit_payments",
      select: "owner_type,owner_id,stripe_customer_id,purchaser_email,created_at",
      orderBy: { column: "created_at", ascending: false },
      pageSize: 1000,
    }),
  ]);

  const subscribers = buildSubscriberRows({
    entitlements: parseEntitlements(entitlementRows),
    lots: lotRows,
    freeUsageRows,
    payments: parsePayments(paymentRows),
  });

  return {
    generatedAt,
    summary: {
      knownUsers: subscribers.length,
      proUsers: subscribers.filter((row) => row.plan === "pro").length,
      topUpUsers: subscribers.filter((row) => row.plan === "topup").length,
      freeUsers: subscribers.filter((row) => row.plan === "free").length,
      remainingCredits: subscribers.reduce((sum, row) => sum + row.remainingCredits, 0),
    },
    subscribers,
  };
}
