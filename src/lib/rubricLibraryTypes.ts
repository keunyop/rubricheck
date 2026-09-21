export type SavedRubricFile = { name: string; size: number; type: string };
export type SavedRubric = {
  id: string;
  name: string;
  lastUsedAt: number;
  files: SavedRubricFile[];
};
export type SavedRubricDetail = SavedRubric & { text: string };
export const RUBRIC_LIBRARY_LIMIT = 50;
export const RUBRIC_NAME_LIMIT = 80;
