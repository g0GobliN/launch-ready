import { getServiceRoleClient } from "./supabase.server";
import { callAI } from "./ai-client.server";

import { AI_FIX_COSTS } from "./plans";

// Fix IDs that trigger AI generation
export const AI_FIX_IDS = new Set(["vitest-ai", "playwright-ai", "api-tests"]);

const GITHUB_API = "https://api.github.com";

async function ghFetch(token: string, path: string) {
  return fetch(`${GITHUB_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
  });
}

async function fetchFile(token: string, fullName: string, filePath: string): Promise<string | null> {
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
      "src/App.tsx", "src/App.jsx",
      "src/main.tsx", "src/main.jsx",
      "app/page.tsx", "app/page.jsx",
      "pages/index.tsx", "pages/index.jsx",
    ];
    for (const p of candidates) {
      const c = await fetchFile(token, fullName, p);
      if (c) { files[p] = c.slice(0, 3000); break; }
    }
  }

  if (fixIds.includes("api-tests")) {
    const candidates = [
      "src/index.ts", "src/app.ts", "src/server.ts",
      "index.js", "app.js", "server.js",
    ];
    for (const p of candidates) {
      const c = await fetchFile(token, fullName, p);
      if (c) { files[p] = c.slice(0, 3000); break; }
    }
  }

  return files;
}

function buildPrompt(fixId: string, files: Record<string, string>): string {
  const ctx = Object.entries(files)
    .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
    .join("\n\n");

  if (fixId === "vitest-ai") {
    return `You are a test engineer. Given the project files below, write practical Vitest unit tests.
Focus on the main component or exported functions. Return ONLY the TypeScript test file content — no markdown fences, no explanation.
The output will be saved as tests/unit.test.ts.

${ctx}`;
  }

  if (fixId === "playwright-ai") {
    return `You are a test engineer. Given the project files below, write Playwright end-to-end tests for the main user flows.
Return ONLY the TypeScript test file content — no markdown fences, no explanation.
The output will be saved as e2e/main.spec.ts.

${ctx}`;
  }

  // api-tests (Express Supertest)
  return `You are a test engineer. Given the Express server files below, write Supertest integration tests for the main API routes.
Return ONLY the TypeScript test file content — no markdown fences, no explanation.
The output will be saved as tests/api.test.ts.

${ctx}`;
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

// Returns cached result if available; otherwise calls Claude and caches the result.
// The caller is responsible for credit deduction — this function never charges credits.
export async function generateAiTests(
  scanId: string,
  fixIds: string[],
  fullName: string,
  token: string,
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

  const relevantFiles = await fetchRelevantFiles(token, fullName, fixIds);
  const results: AiTestFile[] = [];

  for (const fixId of fixIds) {
    const prompt = buildPrompt(fixId, relevantFiles);
    const text = await callAI(prompt, 2048);
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
