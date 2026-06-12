export type PlanId = "free" | "starter" | "pro" | "agency";

/** Paid plans use -1 for unlimited repositories. */
export const UNLIMITED_REPOS = -1;

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  repos: number;
  scansPerMonth: number;
  aiCreditsPerMonth: number;
  /** One-time trial credits on signup (free only). */
  trialCredits?: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    repos: 1,
    scansPerMonth: 3,
    aiCreditsPerMonth: 0,
    trialCredits: 3,
    features: [
      "1 repository",
      "3 scans / month",
      "3 trial AI credits (one-time)",
      "Unlimited template fixes",
      "Community support",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 9.8,
    repos: UNLIMITED_REPOS,
    scansPerMonth: 20,
    aiCreditsPerMonth: 15,
    features: [
      "Unlimited repositories",
      "20 scans / month",
      "15 AI credits / month",
      "Unlimited template fixes",
      "Job history",
    ],
    highlighted: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 19.8,
    repos: UNLIMITED_REPOS,
    scansPerMonth: 100,
    aiCreditsPerMonth: 60,
    features: [
      "Unlimited repositories",
      "100 scans / month",
      "60 AI credits / month",
      "Architecture analysis",
      "Advanced reports",
      "Priority queue",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceUsd: 78.8,
    repos: UNLIMITED_REPOS,
    scansPerMonth: 500,
    aiCreditsPerMonth: 200,
    features: [
      "Unlimited repositories",
      "500 scans / month",
      "200 AI credits / month",
      "Team dashboard",
      "Priority processing",
      "Reports",
    ],
  },
};

// Per AI-fix credit costs
export const AI_FIX_COSTS: Record<string, number> = {
  "ci-ai": 1,
  "readme-ai": 1,
  "env-example-ai": 1,
  "vitest-ai": 2,
  "playwright-ai": 3,
  "api-tests": 3,
};

// Fix IDs that trigger AI generation (safe to import client-side)
export const AI_FIX_IDS = new Set(Object.keys(AI_FIX_COSTS));

export const ARCH_SCAN_COST = 3;

// Minimum plan required to access each feature
export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "agency"];

export function planAllows(userPlan: PlanId, minPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan);
}

export function formatRepoLimit(repos: number): string {
  return repos < 0 ? "Unlimited" : String(repos);
}

export function isUnlimitedRepos(repos: number): boolean {
  return repos < 0;
}
