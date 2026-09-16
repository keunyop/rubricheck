import type { GradingMode } from "../../lib/schema";

export type AssignmentProject = { id: string; name: string; createdAt: number };
export type AssignmentHistoryItem = {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: number;
  mode: GradingMode;
  overallRange: [number, number];
};
export type AssignmentWorkspace = {
  projects: AssignmentProject[];
  assignments: AssignmentHistoryItem[];
};

export function projectVersions(assignments: AssignmentHistoryItem[], projectId: string) {
  return assignments.filter(item => item.projectId === projectId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

// Keep history identifiable even though the scoring engine uses a generic result title.
export function assignmentTitle(assignmentText: string, fileNames: string[] = []): string {
  const fileName = fileNames.find(name => /\.(pdf|docx|txt)$/i.test(name));
  const source = fileName
    ? fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")
    : assignmentText.split(/\r?\n/).map(line => line.trim().replace(/^#+\s*/, "")).find(Boolean) ?? "";
  const title = source.replace(/\s+/g, " ").trim();
  return title.length > 80 ? title.slice(0, 77).trimEnd() + "?" : title || "Untitled assignment";
}
