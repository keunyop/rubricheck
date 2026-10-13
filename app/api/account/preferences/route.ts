import { z } from "zod";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getLanguagePreferences, saveLanguagePreferences } from "../../../../src/lib/languagePreferences";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { LOCALES } from "../../../../src/i18n/config";

export const runtime = "nodejs";
const schema = z.object({ siteLanguage: z.enum(LOCALES), resultLanguage: z.enum(LOCALES) }).strict();
export async function GET(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to save your language preferences.");
  try { return successJson(context, { preferences: await getLanguagePreferences(email) }, { "Cache-Control": "private, no-store" }); }
  catch { return errorResponse(context, 503, "PREFERENCES_UNAVAILABLE", "Could not load language preferences. Try again."); }
}
export async function PUT(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to save your language preferences.");
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return errorResponse(context, 403, "INVALID_ORIGIN", "Invalid request origin.");
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return errorResponse(context, 400, "INVALID_LANGUAGE", "Choose a supported language.");
  try {
    await saveLanguagePreferences(email, input.data);
    return successJson(context, { preferences: input.data }, { "Cache-Control": "private, no-store" });
  } catch { return errorResponse(context, 503, "PREFERENCES_UNAVAILABLE", "Could not save language preferences. Try again."); }
}
