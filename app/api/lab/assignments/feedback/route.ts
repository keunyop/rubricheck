import { z } from "zod";
import { labBody, labHeaders, labId, labRoute } from "../../../../../src/lib/assignmentLab/http";
import { labRpc } from "../../../../../src/lib/assignmentLab/store";

export const POST = labRoute(async (request, owner) => {
  const input = await labBody(request, z.object({ id: labId, runId: labId, helpful: z.boolean() }).strict());
  await labRpc("save_feedback", { p_owner: owner, p_assignment: input.id, p_run: input.runId, p_helpful: input.helpful });
  return Response.json({ ok: true }, { headers: labHeaders });
});

