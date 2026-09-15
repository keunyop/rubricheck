import { z } from "zod";
import { labBody, labHeaders, labId, labRoute, labText } from "../../../../src/lib/assignmentLab/http";
import { labRpc, getWorkspace, listWorkspaces } from "../../../../src/lib/assignmentLab/store";
import { labIsPro } from "../../../../src/lib/assignmentLab/plan";
import { LabError } from "../../../../src/lib/assignmentLab/access";

export const runtime = "nodejs";

export const GET = labRoute(async (request, owner, email) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    if (!labId.safeParse(id).success) throw new LabError(400, "INVALID_ID", "Invalid assignment ID.");
    const exported = url.searchParams.get("download") === "1";
    const workspace = exported
      ? await labRpc("export_workspace", { p_owner: owner, p_assignment: id })
      : await getWorkspace(owner, id);
    return Response.json(workspace, { headers: {
      ...labHeaders, ...(exported ? { "Content-Disposition": 'attachment; filename="rubricheck-assignment-' + id + '.json"' } : {}),
    } });
  }
  const [assignments, pro] = await Promise.all([listWorkspaces(owner), labIsPro(email)]);
  return Response.json({ assignments, plan: pro ? "pro" : "free" }, { headers: labHeaders });
});

export const POST = labRoute(async (request, owner, email) => {
  const input = await labBody(request, z.object({
    id: labId, title: z.string().trim().min(1).max(160), rubricText: labText, draftText: labText,
    mode: z.enum(["standard", "strict"]).default("standard"),
  }).strict());
  const id = await labRpc<string>("create_assignment", {
    p_owner: owner, p_id: input.id, p_title: input.title, p_rubric: input.rubricText,
    p_draft: input.draftText.replace(/\r\n?/g, "\n"), p_mode: input.mode, p_pro: await labIsPro(email),
  });
  return Response.json(await getWorkspace(owner, id), { status: 201, headers: labHeaders });
});

export const DELETE = labRoute(async (request, owner) => {
  const { id } = await labBody(request, z.object({ id: labId }).strict());
  await labRpc("delete_assignment", { p_owner: owner, p_assignment: id });
  return Response.json({ ok: true }, { headers: labHeaders });
});

