export type TaskType =
  | "architecture_analysis"
  | "refactoring_suggestions"
  | "vitest_generation"
  | "playwright_generation"
  | "api_test_generation"
  | "readme_improvements"
  | "ci_generation"
  | "env_example_generation";

export type UserPlan = "free" | "pro" | "enterprise";

export interface AIProvider {
  generate(prompt: string, maxTokens?: number, repoUrl?: string, model?: string): Promise<string>;
  analyze(prompt: string, maxTokens?: number, repoUrl?: string, model?: string): Promise<string>;
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
  /** Full GitHub URL (https://github.com/owner/repo). When set and the active
   *  provider supports repo access (e.g. Cursor), the agent reads the real
   *  codebase instead of relying solely on pasted file context. */
  repoUrl?: string;
}
