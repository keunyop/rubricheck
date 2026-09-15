import { getCreditEmailFromCookie } from "../creditSession";
import { isAdminEmail } from "../adminAuth";

export class LabError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function labEmailAllowed(email: string): boolean {
  const testers = (process.env.ASSIGNMENT_LAB_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return isAdminEmail(email) || testers.includes(email.toLowerCase());
}

export function requireLabEmail(request: Request): string {
  const email = getCreditEmailFromCookie(request);
  if (!email) throw new LabError(401, "AUTH_REQUIRED", "Log in on the home page, then return to this lab URL.");
  if (!labEmailAllowed(email)) throw new LabError(404, "NOT_FOUND", "This workspace is not available.");
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new LabError(403, "INVALID_ORIGIN", "Please submit changes from this website.");
    }
  }
  return email;
}

