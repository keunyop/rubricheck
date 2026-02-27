type JsonRecord = Record<string, unknown>;

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
