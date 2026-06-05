export type PlanId = "free" | "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  priceYen: number;
  repos: number;
  scansPerMonth: number;
  aiCreditsPerMonth: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceYen: 0,
    repos: 1,
    scansPerMonth: 3,
    aiCreditsPerMonth: 0,
    features: ["1 repository", "3 scans / month", "Template fixes only", "Community support"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceYen: 490,
    repos: 3,
    scansPerMonth: 20,
    aiCreditsPerMonth: 10,
    features: ["3 repositories", "20 scans / month", "10 AI credits / month", "Unlimited template fixes", "Job history"],
    highlighted: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceYen: 980,
    repos: 10,
    scansPerMonth: 100,
    aiCreditsPerMonth: 50,
    features: ["10 repositories", "100 scans / month", "50 AI credits / month", "Unlimited template fixes", "Architecture analysis", "Priority queue", "Advanced reports"],
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceYen: 2980,
    repos: 50,
    scansPerMonth: 500,
    aiCreditsPerMonth: 250,
    features: ["50 repositories", "500 scans / month", "250 AI credits / month", "Team dashboard", "Reports", "Priority processing"],
  },
};

// Per AI-fix credit costs
export const AI_FIX_COSTS: Record<string, number> = {
  "vitest-ai": 1,
  "playwright-ai": 2,
  "api-tests": 2,
};

export const ARCH_SCAN_COST = 3;

// Minimum plan required to access each feature
export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "agency"];

export function planAllows(userPlan: PlanId, minPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan);
}
