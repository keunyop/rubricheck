export const FEEDBACK_CATEGORIES = {
  issue: "Report a problem",
  idea: "Suggest an improvement",
  other: "Something else",
} as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;
export const MAX_FEEDBACK_LENGTH = 5000;
export type ProductFeedback = {
  id: string;
  category: FeedbackCategory;
  message: string;
  replyEmail: string | null;
  accountEmail: string | null;
  page: string;
  createdAt: string;
};
export type FeedbackPage = { items: ProductFeedback[]; nextOffset: number | null };
