import { z } from "zod";
import { labBody, labHeaders, labId, labRoute } from "../../../../../src/lib/assignmentLab/http";
import { labRpc } from "../../../../../src/lib/assignmentLab/store";

export const POST = labRoute(async (request, owner) => {
  const input = await labBody(request, z.object({ id: labId, runId: labId, taskKey: labId, done: z.boolean() }).strict());
  await labRpc("set_task", { p_owner: owner, p_assignment: input.id, p_run: input.runId, p_task: input.taskKey, p_done: input.done });
  return Response.json({ ok: true }, { headers: labHeaders });
});

