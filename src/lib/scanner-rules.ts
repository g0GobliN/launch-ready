export interface PackageJsonLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface IssueInput {
  category: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  why: string;
  timeSaved: string;
  fixId: string;
}

export const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
};

export const README_SETUP_HEADING =
  /##?\s*(setup|install|installation|getting.started|quick.start|development|run.locally|local.development|running.locally|prerequisites|configuration|dev.setup)/i;

export const README_PATHS = ["README.md", "readme.md", "README", "README.markdown", "Readme.md"];

export function calcScore(issues: IssueInput[]): number {
  const total = issues.reduce((sum, i) => sum + (SEVERITY_WEIGHT[i.severity] ?? 0), 0);
  return Math.max(0, 100 - total);
}

export function hasReadmeSetupSection(readme: string | null): boolean {
  if (!readme) return false;
  return README_SETUP_HEADING.test(readme);
}

export function detectFramework(pkg: PackageJsonLike): string {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  if (all["next"]) return "Next.js";
  if (all["vite"]) return "Vite";
  if (all["express"]) return "Express";
  if (all["react"]) return "React";
  return "unknown";
}

export function isSupportedFramework(framework: string): boolean {
  return ["Next.js", "Vite", "React", "Express"].includes(framework);
}

export function checkCI(files: string[], issues: IssueInput[]) {
  const hasCI = files.some(
    (f) => f.startsWith(".github/workflows/") && (f.endsWith(".yml") || f.endsWith(".yaml")),
  );
  if (!hasCI) {
    issues.push({
      category: "CI/CD",
      title: "No GitHub Actions CI workflow",
      severity: "critical",
      why: "Every push should automatically run lint, typecheck, and tests. Without CI, bugs reach main undetected.",
      timeSaved: "2h",
      fixId: "github-actions",
    });
  }
}

export function checkEnvExample(envExists: boolean, issues: IssueInput[]) {
  if (!envExists) {
    issues.push({
      category: "Security",
      title: "Missing .env.example",
      severity: "high",
      why: "Contributors can't run your app without knowing which env vars are required. .env.example documents them safely.",
      timeSaved: "30m",
      fixId: "env-example",
    });
  }
}

export function checkReadme(readme: string | null, issues: IssueInput[]) {
  if (!hasReadmeSetupSection(readme)) {
    issues.push({
      category: "Documentation",
      title: "Missing setup instructions",
      severity: "medium",
      why: "New contributors can't clone, install, and run the project without a setup section.",
      timeSaved: "1h",
      fixId: "readme",
    });
  }
}

export function checkTestScript(scripts: Record<string, string>, issues: IssueInput[]) {
  const test = scripts["test"] ?? "";
  const isMissing = !test || test.startsWith("echo") || test.includes("no test specified");
  if (isMissing) {
    issues.push({
      category: "Testing",
      title: "No test script in package.json",
      severity: "high",
      why: "Without a runnable test command, CI can't verify correctness and regressions go undetected.",
      timeSaved: "1h",
      fixId: "vitest",
    });
  }
}

export function checkLintScript(scripts: Record<string, string>, issues: IssueInput[]) {
  if (!scripts["lint"]) {
    issues.push({
      category: "Code Quality",
      title: "No lint script in package.json",
      severity: "medium",
      why: "A lint step in CI catches style and correctness issues before review.",
      timeSaved: "30m",
      fixId: "eslint",
    });
  }
}

export function checkDockerfile(files: string[], issues: IssueInput[]) {
  const hasDocker = files.some(
    (f) =>
      f === "Dockerfile" ||
      f === "docker-compose.yml" ||
      f === "docker-compose.yaml" ||
      f.endsWith("/Dockerfile"),
  );
  if (!hasDocker) {
    issues.push({
      category: "Deployment",
      title: "No Dockerfile or docker-compose",
      severity: "medium",
      why: "A Dockerfile makes builds reproducible across local, CI, and production hosts.",
      timeSaved: "2h",
      fixId: "dockerfile",
    });
  }
}

export function checkMonitoring(
  deps: Record<string, string>,
  files: string[],
  issues: IssueInput[],
) {
  const hasSentry =
    deps["@sentry/react"] ||
    deps["@sentry/nextjs"] ||
    deps["@sentry/node"] ||
    files.some((f) => /sentry/i.test(f));
  if (!hasSentry) {
    issues.push({
      category: "Monitoring",
      title: "No error monitoring (Sentry)",
      severity: "high",
      why: "You won't know production crashes happened until users complain.",
      timeSaved: "2h",
      fixId: "monitoring",
    });
  }
}

export function checkNextJs(deps: Record<string, string>, files: string[], issues: IssueInput[]) {
  if (!deps["vitest"]) {
    issues.push({
      category: "Testing",
      title: "No unit tests",
      severity: "high",
      why: "Vitest integrates tightly with Next.js and gives fast feedback on component and logic regressions. AI-generated tests import your real components.",
      timeSaved: "3h",
      fixId: "vitest-ai",
    });
  }
  if (!deps["@playwright/test"]) {
    issues.push({
      category: "Testing",
      title: "No end-to-end tests",
      severity: "medium",
      why: "E2E tests catch broken user flows that unit tests miss. AI-generated tests cover your actual routes.",
      timeSaved: "4h",
      fixId: "playwright-ai",
    });
  }
  const hasErrorBoundary = files.some(
    (f) =>
      /^app\/.*\/error\.(tsx?|jsx?)$/.test(f) ||
      /^app\/error\.(tsx?|jsx?)$/.test(f) ||
      /^pages\/_error\.(tsx?|jsx?)$/.test(f),
  );
  if (!hasErrorBoundary) {
    issues.push({
      category: "Reliability",
      title: "Missing error boundary (error.tsx)",
      severity: "medium",
      why: "Without an error boundary, uncaught errors show a generic Next.js error page instead of a branded fallback.",
      timeSaved: "1h",
      fixId: "error-boundary",
    });
  }
}

export function checkVite(deps: Record<string, string>, files: string[], issues: IssueInput[]) {
  if (!deps["vitest"]) {
    issues.push({
      category: "Testing",
      title: "No unit tests",
      severity: "high",
      why: "Vitest is the fastest unit test runner for Vite projects and shares the same config. AI-generated tests import your real components.",
      timeSaved: "3h",
      fixId: "vitest-ai",
    });
  }
  if (!deps["@playwright/test"]) {
    issues.push({
      category: "Testing",
      title: "No end-to-end tests",
      severity: "medium",
      why: "E2E tests catch broken user flows that unit tests miss. AI-generated tests cover your actual routes.",
      timeSaved: "4h",
      fixId: "playwright-ai",
    });
  }
  const hasEslint =
    deps["eslint"] ||
    files.some((f) =>
      /^\.(eslintrc(\.(js|ts|json|cjs|mjs))?|eslint\.config\.(js|ts|cjs|mjs))$/.test(f),
    );
  if (!hasEslint) {
    issues.push({
      category: "Code Quality",
      title: "ESLint not configured",
      severity: "high",
      why: "ESLint catches common bugs and enforces consistent style across contributors.",
      timeSaved: "1h",
      fixId: "eslint",
    });
  }
  const hasPrettier =
    deps["prettier"] || files.some((f) => /^\.prettierrc(\.(js|ts|json|yaml|yml))?$/.test(f));
  if (!hasPrettier) {
    issues.push({
      category: "Code Quality",
      title: "Prettier not configured",
      severity: "low",
      why: "Prettier removes formatting debates and keeps diffs clean.",
      timeSaved: "30m",
      fixId: "prettier",
    });
  }
}

export function checkExpress(deps: Record<string, string>, issues: IssueInput[]) {
  if (!deps["helmet"]) {
    issues.push({
      category: "Security",
      title: "Missing Helmet (HTTP security headers)",
      severity: "high",
      why: "Helmet sets secure HTTP headers that protect against XSS, clickjacking, and other common attacks.",
      timeSaved: "1h",
      fixId: "helmet",
    });
  }
  if (!deps["express-rate-limit"]) {
    issues.push({
      category: "Security",
      title: "Missing rate limiting",
      severity: "high",
      why: "Without rate limiting, your API is open to brute-force and denial-of-service attacks.",
      timeSaved: "1h",
      fixId: "rate-limit",
    });
  }
  const hasLogger = deps["morgan"] || deps["winston"] || deps["pino"];
  if (!hasLogger) {
    issues.push({
      category: "Observability",
      title: "Missing request logger (Morgan / Pino)",
      severity: "medium",
      why: "Without logging, debugging production issues requires guesswork. A request logger gives instant visibility.",
      timeSaved: "1h",
      fixId: "logger",
    });
  }
  if (!deps["supertest"]) {
    issues.push({
      category: "Testing",
      title: "Missing API tests (Supertest)",
      severity: "high",
      why: "Supertest lets you test Express routes without a real server, ensuring endpoints behave correctly.",
      timeSaved: "3h",
      fixId: "api-tests",
    });
  }
}

export function dedupeIssues(issues: IssueInput[]): IssueInput[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    if (seen.has(i.fixId)) return false;
    seen.add(i.fixId);
    return true;
  });
}
