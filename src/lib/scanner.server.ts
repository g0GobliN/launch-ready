const GITHUB_API = "https://api.github.com";

interface PackageJson {
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

export interface ScanResult {
  score: number;
  framework: string;
  issues: IssueInput[];
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
};

function calcScore(issues: IssueInput[]): number {
  const total = issues.reduce((sum, i) => sum + (SEVERITY_WEIGHT[i.severity] ?? 0), 0);
  return Math.max(0, 100 - total);
}

async function ghFetch(token: string, path: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
}

async function fetchFileContent(
  token: string,
  fullName: string,
  filePath: string,
): Promise<string | null> {
  const res = await ghFetch(token, `/repos/${fullName}/contents/${filePath}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return null;
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function fetchFileTree(
  token: string,
  fullName: string,
  defaultBranch: string,
): Promise<string[]> {
  const res = await ghFetch(token, `/repos/${fullName}/git/trees/${defaultBranch}?recursive=1`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    tree: Array<{ path: string; type: string }>;
    truncated?: boolean;
  };
  return data.tree.filter((n) => n.type === "blob").map((n) => n.path);
}

function detectFramework(pkg: PackageJson): string {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  if (all["next"]) return "Next.js";
  if (all["vite"]) return "Vite";
  if (all["express"]) return "Express";
  if (all["react"]) return "React";
  return "unknown";
}

// ─── Shared checks ────────────────────────────────────────────────────────────

function checkCI(files: string[], issues: IssueInput[]) {
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

function checkEnvExample(envExists: boolean, issues: IssueInput[]) {
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

function checkReadme(readme: string | null, issues: IssueInput[]) {
  const hasSetup = readme
    ? /##?\s*(setup|install|getting.started|quick.start)/i.test(readme)
    : false;
  if (!hasSetup) {
    issues.push({
      category: "Documentation",
      title: "README missing setup section",
      severity: "medium",
      why: "New contributors can't get the project running without setup instructions.",
      timeSaved: "1h",
      fixId: "readme",
    });
  }
}

function checkTestScript(scripts: Record<string, string>, issues: IssueInput[]) {
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

function checkLintScript(scripts: Record<string, string>, issues: IssueInput[]) {
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

// ─── Next.js checks ───────────────────────────────────────────────────────────

function checkNextJs(deps: Record<string, string>, files: string[], issues: IssueInput[]) {
  if (!deps["vitest"]) {
    issues.push({
      category: "Testing",
      title: "Missing Vitest (unit tests)",
      severity: "high",
      why: "Vitest integrates tightly with Next.js and gives fast feedback on component and logic regressions.",
      timeSaved: "3h",
      fixId: "vitest",
    });
  }
  if (!deps["@playwright/test"]) {
    issues.push({
      category: "Testing",
      title: "Missing Playwright (end-to-end tests)",
      severity: "medium",
      why: "E2E tests catch broken user flows that unit tests miss. Playwright is the standard for Next.js apps.",
      timeSaved: "4h",
      fixId: "playwright",
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

// ─── Vite / React checks ──────────────────────────────────────────────────────

function checkVite(deps: Record<string, string>, files: string[], issues: IssueInput[]) {
  if (!deps["vitest"]) {
    issues.push({
      category: "Testing",
      title: "Missing Vitest (unit tests)",
      severity: "high",
      why: "Vitest is the fastest unit test runner for Vite projects and shares the same config.",
      timeSaved: "3h",
      fixId: "vitest",
    });
  }
  if (!deps["@playwright/test"]) {
    issues.push({
      category: "Testing",
      title: "Missing Playwright (end-to-end tests)",
      severity: "medium",
      why: "E2E tests catch broken user flows that unit tests miss.",
      timeSaved: "4h",
      fixId: "playwright",
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

// ─── Express checks ───────────────────────────────────────────────────────────

function checkExpress(deps: Record<string, string>, issues: IssueInput[]) {
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

// ─── Public entry point ───────────────────────────────────────────────────────

export async function scanRepository(
  token: string,
  fullName: string,
  defaultBranch: string,
): Promise<ScanResult> {
  // Fetch in parallel to minimise latency
  const [pkgRaw, readmeRaw, envExampleRaw, files] = await Promise.all([
    fetchFileContent(token, fullName, "package.json"),
    fetchFileContent(token, fullName, "README.md").catch(() => null),
    fetchFileContent(token, fullName, ".env.example").catch(() => null),
    fetchFileTree(token, fullName, defaultBranch),
  ]);

  const pkg: PackageJson = pkgRaw ? (JSON.parse(pkgRaw) as PackageJson) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts ?? {};
  const framework = detectFramework(pkg);

  const issues: IssueInput[] = [];

  // Shared
  checkCI(files, issues);
  checkEnvExample(envExampleRaw !== null, issues);
  checkReadme(readmeRaw, issues);
  checkTestScript(scripts, issues);
  checkLintScript(scripts, issues);

  // Framework-specific
  if (framework === "Next.js") checkNextJs(deps, files, issues);
  else if (framework === "Vite" || framework === "React") checkVite(deps, files, issues);
  else if (framework === "Express") checkExpress(deps, issues);

  // De-duplicate by fixId (shared + framework checks can overlap on e.g. vitest)
  const seen = new Set<string>();
  const unique = issues.filter((i) => {
    if (seen.has(i.fixId)) return false;
    seen.add(i.fixId);
    return true;
  });

  return { score: calcScore(unique), framework, issues: unique };
}
