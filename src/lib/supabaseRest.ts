export type JsonRecord = Record<string, unknown>;

type SupabaseFilterOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "is";

export type SupabaseFilter = {
  column: string;
  operator?: SupabaseFilterOperator;
  value: string | number | boolean | null;
};

type SupabaseOrder = {
  column: string;
  ascending?: boolean;
  nulls?: "first" | "last";
};

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function getSupabaseUrl(): string {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) {
    throw new Error("SUPABASE_URL_MISSING");
  }

  return normalizeBaseUrl(value);
}

function getSupabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY_MISSING");
  }

  return value;
}

function getHeaders(): HeadersInit {
  const key = getSupabaseServiceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function buildTableEndpoint(tableName: string): string {
  return `${getSupabaseUrl()}/rest/v1/${encodeURIComponent(tableName.trim())}`;
}

function formatFilterValue(value: SupabaseFilter["value"]): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function applyFilters(searchParams: URLSearchParams, filters: SupabaseFilter[]): void {
  for (const filter of filters) {
    const operator = filter.operator ?? "eq";
    searchParams.set(filter.column, `${operator}.${formatFilterValue(filter.value)}`);
  }
}

function applyOrder(searchParams: URLSearchParams, orderBy: SupabaseOrder): void {
  const parts = [orderBy.column, orderBy.ascending === false ? "desc" : "asc"];
  if (orderBy.nulls === "first") {
    parts.push("nullsfirst");
  }
  if (orderBy.nulls === "last") {
    parts.push("nullslast");
  }
  searchParams.set("order", parts.join("."));
}

export async function callSupabaseRpc<T>(functionName: string, params: JsonRecord): Promise<T> {
  const endpoint = `${getSupabaseUrl()}/rest/v1/rpc/${functionName}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SUPABASE_RPC_FAILED:${functionName}:${response.status}:${details}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function selectSupabaseRows<T>(params: {
  table: string;
  select?: string;
  filters?: SupabaseFilter[];
  orderBy?: SupabaseOrder;
  limit?: number;
}): Promise<T[]> {
  const endpoint = new URL(buildTableEndpoint(params.table));
  endpoint.searchParams.set("select", params.select?.trim() || "*");
  if (params.filters?.length) {
    applyFilters(endpoint.searchParams, params.filters);
  }
  if (params.orderBy) {
    applyOrder(endpoint.searchParams, params.orderBy);
  }
  if (typeof params.limit === "number" && Number.isFinite(params.limit) && params.limit > 0) {
    endpoint.searchParams.set("limit", String(Math.floor(params.limit)));
  }

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SUPABASE_SELECT_FAILED:${params.table}:${response.status}:${details}`);
  }

  if (response.status === 204) {
    return [];
  }

  return (await response.json()) as T[];
}

export async function updateSupabaseRows<T>(params: {
  table: string;
  patch: JsonRecord;
  filters: SupabaseFilter[];
  select?: string;
}): Promise<T[]> {
  const endpoint = new URL(buildTableEndpoint(params.table));
  endpoint.searchParams.set("select", params.select?.trim() || "*");
  applyFilters(endpoint.searchParams, params.filters);

  const response = await fetch(endpoint.toString(), {
    method: "PATCH",
    headers: {
      ...getHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(params.patch),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SUPABASE_UPDATE_FAILED:${params.table}:${response.status}:${details}`);
  }

  if (response.status === 204) {
    return [];
  }

  return (await response.json()) as T[];
}
