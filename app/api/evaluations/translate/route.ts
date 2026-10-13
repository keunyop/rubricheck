import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { LOCALES } from "../../../../src/i18n/config";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getArchivedAssignment } from "../../../../src/lib/assignmentWorkspace";
import { getEvaluation, normalizeEvaluationId, ownerHash, recoveryRedis } from "../../../../src/lib/evaluationRecovery";
import { readTrial, trialIdentity } from "../../../../src/lib/guestTrial";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { restrictEvaluationFeedback } from "../../../../lib/gradeFinalization";
import { callEvaluationModel } from "../../../../lib/openai";
import { applyResultTranslation, resultTextFields, translationPrompt, type TranslatableResult } from "../../../../lib/resultTranslation";

export const runtime = "nodejs";
export const maxDuration = 300;
const schema = z.object({ evaluationId: z.string().refine(value => Boolean(normalizeEvaluationId(value))).optional(), language: z.enum(LOCALES) }).strict();
export async function POST(request: Request) {
  const context = createRequestContext(request);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return errorResponse(context, 400, "INVALID_INPUT", "Choose a supported language and an available result.");
  const email = getCreditEmailFromCookie(request);
  const { evaluationId, language } = input.data;
  if (evaluationId && !email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to translate this result.");
  let lockKey: string | undefined;
  const lease = randomUUID();
  try {
    let result: TranslatableResult | null = null;
    let owner: string;
    if (evaluationId && email) {
      owner = ownerHash(email);
      const archived = await getArchivedAssignment(email, evaluationId);
      const saved = archived?.result ?? (await getEvaluation(evaluationId, email))?.result;
      result = saved ? restrictEvaluationFeedback(saved) : null;
    } else {
      const identity = trialIdentity(request);
      owner = ownerHash(identity.token);
      result = (await readTrial(identity)).result;
    }
    if (!result) return errorResponse(context, 404, "RESULT_UNAVAILABLE", "This result is no longer available for translation.");
    const respond = (translated: TranslatableResult) => successJson(context, { result: translated }, { "Cache-Control": "private, no-store" });
    if (result.language === language) return respond(result);
    const redis = recoveryRedis();
    const fingerprint = createHash("sha256").update(JSON.stringify(result)).digest("hex");
    const key = `rubricheck:translation:${owner}:${fingerprint}:${language}`;
    const cached = await redis.get<{ translations: string[] }>(key);
    if (cached) return respond(applyResultTranslation(result, cached, language));
    const rateKey = `rubricheck:translation-rate:${owner}:${Math.floor(Date.now() / 3600000)}`;
    const count = await redis.eval<unknown[], number>("local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 3600) end; return n", [rateKey], []);
    if (count > 30) return errorResponse(context, 429, "TRANSLATION_LIMIT", "Translation limit reached. Please try again later.", undefined, { "Retry-After": "3600" });
    const candidate = key + ":lock";
    if (!await redis.set(candidate, lease, { nx: true, ex: 300 })) return errorResponse(context, 409, "TRANSLATION_PENDING", "A translation is already in progress. Try again shortly.");
    lockKey = candidate;
    const output = await callEvaluationModel(translationPrompt(resultTextFields(result), language));
    const translated = applyResultTranslation(result, output, language);
    await redis.set(key, { translations: resultTextFields(translated) }, { ex: 86400 }).catch(() => {});
    return respond(translated);
  } catch {
    return errorResponse(context, 503, "TRANSLATION_FAILED", "Could not translate this result. Your original result is unchanged. Try again.");
  } finally {
    if (lockKey) await recoveryRedis().eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end; return 0", [lockKey], [lease]).catch(() => {});
  }
}
