export type TaskType =
  | "architecture_analysis"
  | "refactoring_suggestions"
  | "vitest_generation"
  | "playwright_generation"
  | "api_test_generation"
  | "readme_improvements";

export type UserPlan = "free" | "pro" | "enterprise";

export interface AIProvider {
  generate(prompt: string, maxTokens?: number): Promise<string>;
  analyze(prompt: string, maxTokens?: number): Promise<string>;
}

export interface RouterContext {
  taskType: TaskType;
  userPlan?: UserPlan;
  creditCost?: number;
}

export interface AICallOptions extends Partial<RouterContext> {
  maxTokens?: number;
  /** Optional cache key. When provided the router checks the in-memory cache
   *  before calling the provider and stores the result afterward. */
  cacheKey?: string;
}
