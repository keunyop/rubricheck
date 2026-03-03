const DEFAULT_ADMIN_EMAILS = ["kylee1112@hotmail.com"] as const;

export function normalizeAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getPublicAdminEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => normalizeAdminEmail(entry))
    .filter((entry) => entry.length > 0);

  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS.map((entry) => normalizeAdminEmail(entry)), ...fromEnv]));
}

export function isKnownAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return getPublicAdminEmails().includes(normalizeAdminEmail(email));
}
