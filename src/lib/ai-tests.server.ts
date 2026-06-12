import { getServiceRoleClient } from "./supabase.server";
import { aiService } from "../ai";
import type { TaskType } from "../ai";

import { AI_FIX_COSTS, AI_FIX_IDS } from "./plans";

export { AI_FIX_IDS };

const GITHUB_API = "https://api.github.com";

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
  const res = await ghFetch(token, `/repos/${fullName}/contents/${filePath}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return null;
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

// Fetch the minimal set of files relevant to each fix type.
// Never sends the full repo — only the files that matter for the test being generated.
async function fetchRelevantFiles(
  token: string,
  fullName: string,
  fixIds: string[],
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  const pkg = await fetchFile(token, fullName, "package.json");
  if (pkg) files["package.json"] = pkg.slice(0, 2000);

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
    Object.keys(files).length > 1
      ? "\n\nProject files for context:\n\n" +
        Object.entries(files)
          .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
          .join("\n\n")
      : "";

  const repoNote = repoUrl
    ? `The full codebase is at ${repoUrl} — explore it to find the best files to test.`
    : "";

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
  if (fixId === "vitest-ai") return "tests/unit.test.ts";
  if (fixId === "playwright-ai") return "e2e/main.spec.ts";
  return "tests/api.test.ts";
}

export interface AiTestFile {
  fixId: string;
  path: string;
  content: string;
}

// Returns cached result if available; otherwise calls the AI and caches the result.
// The caller is responsible for credit deduction — this function never charges credits.
export async function generateAiTests(
  scanId: string,
  fixIds: string[],
  fullName: string,
  token: string,
  framework?: string,
): Promise<AiTestFile[]> {
  const db = getServiceRoleClient();
  const sortedKey = [...fixIds].sort().join(",");

  const { data: cached } = await db
    .from("ai_test_cache")
    .select("result")
    .eq("scan_id", scanId)
    .eq("fix_ids", sortedKey)
    .maybeSingle();

  if (cached) return JSON.parse(cached.result) as AiTestFile[];

  const repoUrl = `https://github.com/${fullName}`;
  const relevantFiles = await fetchRelevantFiles(token, fullName, fixIds);
  const results: AiTestFile[] = [];

  for (const fixId of fixIds) {
    const prompt = buildPrompt(fixId, relevantFiles, repoUrl, framework);
    const taskType: TaskType =
      fixId === "vitest-ai"
        ? "vitest_generation"
        : fixId === "playwright-ai"
          ? "playwright_generation"
          : "api_test_generation";
    const text = await aiService.generate(prompt, { taskType, maxTokens: 2048, repoUrl });
    results.push({ fixId, path: outputPath(fixId), content: text });
  }

  await db.from("ai_test_cache").insert({
    id: crypto.randomUUID(),
    scan_id: scanId,
    fix_ids: sortedKey,
    result: JSON.stringify(results),
  });

  return results;
}

// Returns true if a cached result already exists for this scan + fix combination.
// Used in createFixRequest to set credits_cost = 0 when the result is already cached.
export async function hasAiTestCache(scanId: string, fixIds: string[]): Promise<boolean> {
  if (fixIds.length === 0) return false;
  const db = getServiceRoleClient();
  const { data } = await db
    .from("ai_test_cache")
    .select("id")
    .eq("scan_id", scanId)
    .eq("fix_ids", [...fixIds].sort().join(","))
    .maybeSingle();
  return !!data;
}
