import { getCreditEmailFromCookie } from "./creditSession";
import { getAccountEntitlementByEmail, isActiveProAccountEntitlement } from "./accountEntitlements";
import { QuizError } from "./quizValidation";

export function quizAccount(request: Request): string {
  const email = getCreditEmailFromCookie(request);
  if (!email) throw new QuizError("AUTH_REQUIRED", 401);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)) throw new QuizError("QUIZ_FORBIDDEN", 403);
  }
  return email;
}
export async function quizPro(email: string): Promise<boolean> {
  return isActiveProAccountEntitlement(await getAccountEntitlementByEmail(email));
}
export function quizResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
export function quizErrorResponse(error: unknown) {
  return error instanceof QuizError ? quizResponse({ code: error.code }, error.status) : quizResponse({ code: "QUIZ_UNAVAILABLE" }, 503);
}
export async function quizJson(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 300_000) throw new QuizError("QUIZ_SOURCE_LIMIT", 413);
  const text = await request.text();
  if (text.length > 300_000) throw new QuizError("QUIZ_SOURCE_LIMIT", 413);
  try { return JSON.parse(text); } catch { throw new QuizError("QUIZ_INVALID_INPUT"); }
}
