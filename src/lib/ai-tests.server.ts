import { createHash } from "crypto";
import { getServiceRoleClient } from "./supabase.server";
import { aiService } from "../ai";
import type { TaskType } from "../ai";

import { githubContentsPath } from "./github.server";
import { AI_FIX_COSTS, AI_FIX_IDS } from "./plans";

function hashFiles(files: Record<string, string>, fixIds: string[]): string {
  const stable = [...fixIds].sort().join(",") + JSON.stringify(Object.entries(files).sort());
  return createHash("sha256").update(stable).digest("hex");
}

export { AI_FIX_IDS };

const GITHUB_API = "https://api.github.com";
const README_PATHS = ["README.md", "readme.md", "README", "README.markdown", "Readme.md"];

async function ghFetch(token: string, path: string) {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "LaunchReadyy/1.0",
    },
  });
}

async function fetchFile(
  token: string,
  fullName: string,
  filePath: string,
): Promise<string | null> {
  const res = await ghFetch(token, `/repos/${fullName}/contents/${githubContentsPath(filePath)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return null;
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function fetchReadme(token: string, fullName: string): Promise<string | null> {
  for (const path of README_PATHS) {
    const content = await fetchFile(token, fullName, path);
    if (content) return content;
  }
  return null;
}

async function fetchTreePaths(
  token: string,
  fullName: string,
): Promise<string[]> {
  const repoRes = await ghFetch(token, `/repos/${fullName}`);
  if (!repoRes.ok) return [];
  const repo = (await repoRes.json()) as { default_branch?: string };
  const branch = repo.default_branch ?? "main";
  const res = await ghFetch(token, `/repos/${fullName}/git/trees/${branch}?recursive=1`);
  if (!res.ok) return [];
  const data = (await res.json()) as { tree: Array<{ path: string; type: string }> };
  return data.tree.filter((n) => n.type === "blob").map((n) => n.path);
}

const ENV_SCAN_DIRS = ["src", "app", "pages", "lib", "server", "api"];

async function scanEnvVarUsages(
  token: string,
  fullName: string,
  paths: string[],
): Promise<string[]> {
  const vars = new Set<string>();
  const candidates = paths.filter((p) =>
    /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p) &&
    ENV_SCAN_DIRS.some((d) => p === `${d}` || p.startsWith(`${d}/`)),
  );
  for (const p of candidates.slice(0, 30)) {
    const content = await fetchFile(token, fullName, p);
    if (!content) continue;
    for (const m of content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) vars.add(m[1]);
    for (const m of content.matchAll(/import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g)) vars.add(m[1]);
  }
  return [...vars].sort();
}

// Fetch the minimal set of files relevant to each fix type.
async function fetchRelevantFiles(
  token: string,
  fullName: string,
  fixIds: string[],
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  const pkg = await fetchFile(token, fullName, "package.json");
  if (pkg) files["package.json"] = pkg.slice(0, 3000);

  if (fixIds.includes("readme-ai")) {
    const readme = await fetchReadme(token, fullName);
    if (readme) files["README.md"] = readme.slice(0, 4000);
  }

  if (fixIds.includes("ci-ai")) {
    const ci = await fetchFile(token, fullName, ".github/workflows/ci.yml");
    if (ci) files[".github/workflows/ci.yml"] = ci.slice(0, 2000);
    const nvmrc = await fetchFile(token, fullName, ".nvmrc");
    if (nvmrc) files[".nvmrc"] = nvmrc.slice(0, 100);
  }

  if (fixIds.includes("env-example-ai")) {
    const env = await fetchFile(token, fullName, ".env.example");
    if (env) files[".env.example"] = env.slice(0, 1000);
    const paths = await fetchTreePaths(token, fullName);
    const envVars = await scanEnvVarUsages(token, fullName, paths);
    if (envVars.length) files["detected_env_vars"] = envVars.join(", ");
  }

  if (fixIds.includes("vitest-ai") || fixIds.includes("playwright-ai")) {
    const candidates = [
      "src/App.tsx",
      "src/App.jsx",
      "src/main.tsx",
      "src/main.jsx",
      "app/page.tsx",
      "app/page.jsx",
      "pages/index.tsx",
      "pages/index.jsx",
    ];
    for (const p of candidates) {
      const c = await fetchFile(token, fullName, p);
      if (c) {
        files[p] = c.slice(0, 3000);
        break;
      }
    }
  }

  if (fixIds.includes("api-tests")) {
    const candidates = [
      "src/index.ts",
      "src/app.ts",
      "src/server.ts",
      "index.js",
      "app.js",
      "server.js",
    ];
    for (const p of candidates) {
      const c = await fetchFile(token, fullName, p);
      if (c) {
        files[p] = c.slice(0, 3000);
        break;
      }
    }
  }

  return files;
}

function buildPrompt(
  fixId: string,
  files: Record<string, string>,
  repoUrl?: string,
  framework?: string,
): string {
  const fw = framework && framework !== "unknown" ? framework : "JavaScript";
  const isReact = fw !== "Express";
  const ctx =
    Object.keys(files).length > 0
      ? "\n\nProject files for context:\n\n" +
        Object.entries(files)
          .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
          .join("\n\n")
      : "";

  const repoNote = repoUrl ? `Repo: ${repoUrl}` : "";

  if (fixId === "ci-ai") {
    return `You are a DevOps engineer writing a GitHub Actions CI workflow for a ${fw} project.${repoUrl ? " " + repoNote : ""}

Write a complete .github/workflows/ci.yml tailored to this repo:
- Detect package manager from lockfiles (pnpm-lock.yaml → pnpm, yarn.lock → yarn, else npm ci)
- Run lint, test, and build scripts only if they exist in package.json
- Use Node version from .nvmrc or engines.node if present, else 20
- Use actions/checkout@v4 and actions/setup-node@v4${ctx}

Return ONLY the YAML file content. No markdown fences, no explanation.
Output path: .github/workflows/ci.yml`;
  }

  if (fixId === "readme-ai") {
    return `You are a technical writer improving README setup docs for a ${fw} project.${repoUrl ? " " + repoNote : ""}

Write or improve the README with a clear setup section:
- Use the actual repo name and detected framework
- List prerequisites, install command, dev command, test command from package.json scripts
- Include env var setup if .env.example is relevant
- Keep existing README content if present — append or integrate a "## Getting Started" section${ctx}

Return ONLY the full README.md markdown content. No markdown fences, no explanation.
Output path: README.md`;
  }

  if (fixId === "env-example-ai") {
    const vars = files["detected_env_vars"] ?? "";
    return `You are a developer documenting environment variables for a ${fw} project.${repoUrl ? " " + repoNote : ""}

Write a .env.example file:
- Include every env var found in the codebase${vars ? ` (${vars})` : ""}
- Add a short comment above each variable explaining what it is
- Use placeholder values (your-api-key-here, postgres://localhost:5432/db) — never real secrets${ctx}

Return ONLY the .env.example file content. No markdown fences, no explanation.
Output path: .env.example`;
  }

  if (fixId === "vitest-ai") {
    return `You are a test engineer working on a ${fw} project.${repoUrl ? " " + repoNote : ""}

Write Vitest unit tests that test real code — NOT a smoke test like \`expect(true).toBe(true)\`.
Requirements:
- Import actual modules: components, hooks, utilities, or helper functions from the source
- Each test verifies real behavior (renders correctly, returns expected values, handles edge cases)
- Test environment: ${isReact ? "jsdom" : "node"}
- Use \`describe\` + \`it\` blocks with clear names${ctx}

Return ONLY the TypeScript test file content. No markdown fences, no explanation.
Output path: tests/unit.test.ts`;
  }

  if (fixId === "playwright-ai") {
    return `You are a test engineer working on a ${fw} project.${repoUrl ? " " + repoNote : ""}

Write Playwright end-to-end tests that cover the main user flows — NOT just checking if the page title is non-empty.
Requirements:
- Navigate to real routes and interact with UI elements
- Assert meaningful outcomes (text content, form submissions, navigation, API responses)
- Use \`page.goto\`, \`page.getByRole\`, \`page.getByText\`, \`expect(locator)\` patterns
- Base URL: \`process.env.BASE_URL ?? "http://localhost:3000"\`${ctx}

Return ONLY the TypeScript test file content. No markdown fences, no explanation.
Output path: e2e/main.spec.ts`;
  }

  // api-tests (Express Supertest)
  return `You are a test engineer working on an Express API.${repoUrl ? " " + repoNote : ""}

Write Supertest integration tests for the main API routes — NOT placeholder assertions.
Requirements:
- Import the Express app instance directly: \`import app from "../src/app"\` or similar
- Test each route: expected status codes, response body shape, error handling
- Use \`describe\` blocks per route, \`it\` blocks per scenario${ctx}

Return ONLY the TypeScript test file content. No markdown fences, no explanation.
Output path: tests/api.test.ts`;
}

function outputPath(fixId: string): string {
  if (fixId === "ci-ai") return ".github/workflows/ci.yml";
  if (fixId === "readme-ai") return "README.md";
  if (fixId === "env-example-ai") return ".env.example";
  if (fixId === "vitest-ai") return "tests/unit.test.ts";
  if (fixId === "playwright-ai") return "e2e/main.spec.ts";
  return "tests/api.test.ts";
}

function taskTypeForFix(fixId: string): TaskType {
  switch (fixId) {
    case "ci-ai":
      return "ci_generation";
    case "readme-ai":
      return "readme_improvements";
    case "env-example-ai":
      return "env_example_generation";
    case "vitest-ai":
      return "vitest_generation";
    case "playwright-ai":
      return "playwright_generation";
    default:
      return "api_test_generation";
  }
}

export interface AiTestFile {
  fixId: string;
  path: string;
  content: string;
}

export async function generateAiTests(
  scanId: string,
  fixIds: string[],
  fullName: string,
  token: string,
  framework?: string,
): Promise<AiTestFile[]> {
  const db = getServiceRoleClient();
  const sortedKey = [...fixIds].sort().join(",");

  const { data: scanCached } = await db
    .from("ai_test_cache")
    .select("result")
    .eq("scan_id", scanId)
    .eq("fix_ids", sortedKey)
    .maybeSingle();
  if (scanCached) return JSON.parse(scanCached.result) as AiTestFile[];

  const repoUrl = `https://github.com/${fullName}`;
  const relevantFiles = await fetchRelevantFiles(token, fullName, fixIds);
  const contentHash = hashFiles(relevantFiles, fixIds);

  const { data: hashCached } = await db
    .from("ai_test_cache")
    .select("result")
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (hashCached) {
    await db.from("ai_test_cache").insert({
      id: crypto.randomUUID(),
      scan_id: scanId,
      fix_ids: sortedKey,
      result: hashCached.result,
      content_hash: contentHash,
    });
    return JSON.parse(hashCached.result) as AiTestFile[];
  }

  const results: AiTestFile[] = [];
  for (const fixId of fixIds) {
    const prompt = buildPrompt(fixId, relevantFiles, repoUrl, framework);
    const taskType = taskTypeForFix(fixId);
    const maxTokens = ["ci-ai", "readme-ai", "env-example-ai"].includes(fixId) ? 1536 : 2048;
    const text = await aiService.generate(prompt, { taskType, maxTokens, repoUrl });
    results.push({ fixId, path: outputPath(fixId), content: text });
  }

  await db.from("ai_test_cache").insert({
    id: crypto.randomUUID(),
    scan_id: scanId,
    fix_ids: sortedKey,
    result: JSON.stringify(results),
    content_hash: contentHash,
  });

  return results;
}

export async function hasAiTestCache(
  scanId: string,
  fixIds: string[],
  fullName?: string,
  token?: string,
): Promise<boolean> {
  if (fixIds.length === 0) return false;
  const db = getServiceRoleClient();
  const sortedKey = [...fixIds].sort().join(",");

  const { data: scanHit } = await db
    .from("ai_test_cache")
    .select("id")
    .eq("scan_id", scanId)
    .eq("fix_ids", sortedKey)
    .maybeSingle();
  if (scanHit) return true;

  if (fullName && token) {
    const relevantFiles = await fetchRelevantFiles(token, fullName, fixIds);
    const contentHash = hashFiles(relevantFiles, fixIds);
    const { data: hashHit } = await db
      .from("ai_test_cache")
      .select("id")
      .eq("content_hash", contentHash)
      .maybeSingle();
    if (hashHit) return true;
  }

  return false;
}
