export const FREE_TRIAL_LIMIT = 3;
export const FREE_DAILY_LIMIT = FREE_TRIAL_LIMIT;
export const PLUS_DAILY_LIMIT = 30;

export const PLAN_NAMES = ["free", "plus", "pro", "semester"] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

type UserWithPlan = {
  plan?: string;
};

export function getPlanFromUser(user?: UserWithPlan): PlanName {
  const rawPlan = user?.plan?.trim().toLowerCase();
  if (!rawPlan) {
    return "free";
  }

  return PLAN_NAMES.includes(rawPlan as PlanName) ? (rawPlan as PlanName) : "free";
}
