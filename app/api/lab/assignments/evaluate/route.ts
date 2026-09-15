import { z } from "zod";
import { labBody, labHeaders, labId, labRoute, labText } from "../../../../../src/lib/assignmentLab/http";
import { evaluateLabAssignment } from "../../../../../src/lib/assignmentLab/evaluate";
import { labIsPro } from "../../../../../src/lib/assignmentLab/plan";

export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = labRoute(async (request, owner, email) => {
  const { id, draftText } = await labBody(request, z.object({ id: labId, draftText: labText }).strict());
  return Response.json(await evaluateLabAssignment(owner, id, draftText, await labIsPro(email)), { headers: labHeaders });
});

