export function getAdminSecretFromRequest(request: Request): string {
  const headerSecret = request.headers.get("x-admin-secret")?.trim();
  if (headerSecret) return headerSecret;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookiePart = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("admin_secret="));

  if (!cookiePart) return "";
  return decodeURIComponent(cookiePart.slice("admin_secret=".length));
}

export function isAdminAuthorized(request: Request): boolean {
  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) return false;
  return getAdminSecretFromRequest(request) === expectedSecret;
}
