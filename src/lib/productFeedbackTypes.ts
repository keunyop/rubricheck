export const FEEDBACK_CATEGORIES = {
  issue: "Report a problem",
  idea: "Suggest an improvement",
  other: "Something else",
} as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;
export const MAX_FEEDBACK_LENGTH = 5000;
export const MAX_REPLY_SUBJECT_LENGTH = 200;
export const MAX_REPLY_LENGTH = 10000;
export type FeedbackReply = {
  id: string;
  status: "pending" | "sent" | "failed" | "unknown";
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  message: string;
  createdAt: string;
  attemptedAt: string;
  sentAt: string | null;
  sentBy: string;
  providerEmailId: string | null;
};
export type FeedbackMailSettings = {
  ready: boolean;
  from: string;
  replyTo: string | null;
};
export type ProductFeedback = {
  id: string;
  category: FeedbackCategory;
  message: string;
  replyEmail: string | null;
  accountEmail: string | null;
  page: string;
  createdAt: string;
};
export type FeedbackInboxItem = ProductFeedback & { replies: FeedbackReply[] };
export type FeedbackPage = { items: FeedbackInboxItem[]; nextOffset: number | null; mailSettings: FeedbackMailSettings };
