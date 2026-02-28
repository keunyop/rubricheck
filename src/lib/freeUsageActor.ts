import { getCreditEmailFromCookie } from "./creditSession.ts";

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function getFreeUsageActor(request: Request): string {
  const creditEmail = getCreditEmailFromCookie(request);
  if (creditEmail) {
    return `email:${creditEmail}`;
  }

  return `ip:${getRequestIp(request)}`;
}
