import { z } from "zod";
import { quizAccount, quizErrorResponse, quizJson, quizResponse } from "../../../../src/lib/quizApi";
import { quizId } from "../../../../src/lib/quizTypes";
import { quizTransaction } from "../../../../src/lib/quizStore";
import { QuizError } from "../../../../src/lib/quizValidation";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), id: quizId, quizId, kind: z.enum(["full", "review"]), fromAttempt: quizId.optional(), restart: z.boolean().default(false) }).refine(v => v.kind !== "review" || Boolean(v.fromAttempt)),
  z.object({ action: z.literal("answer"), id: quizId, quizId, revision: z.number().int().min(0), questionId: z.string().min(1).max(10).optional(), answer: z.number().int().min(0).max(3).optional(), position: z.number().int().min(0).max(19).optional(), finish: z.boolean().optional() }).refine(v => (v.questionId === undefined) === (v.answer === undefined)),
]);
export async function POST(request: Request) {
  try {
    const email = quizAccount(request), parsed = schema.safeParse(await quizJson(request));
    if (!parsed.success) throw new QuizError("QUIZ_INVALID_INPUT");
    const { action, ...input } = parsed.data;
    return quizResponse({ attempt: await quizTransaction(email, action, input) });
  } catch (error) { return quizErrorResponse(error); }
}
