// Implements real PR creation via the GitHub Trees API.
// Replaces the fake sleep + random PR number in runFixJob.

const GITHUB_API = "https://api.github.com";

// ─── GitHub API helpers ───────────────────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "LaunchReadyy/1.0",
  };
}

async function ghGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders(token) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub GET ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function ghPost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function ghPatch<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "PATCH",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub PATCH ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchFileContent(
  token: string,
  fullName: string,
  path: string,
): Promise<string | null> {
  try {
    const data = await ghGet<{ content?: string; encoding?: string }>(
      token,
      `/repos/${fullName}/contents/${encodeURIComponent(path)}`,
    );
    if (!data.content || data.encoding !== "base64") return null;
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  } catch {
    return null;
  }
}

// ─── GitHub Trees API ─────────────────────────────────────────────────────────

async function createBlob(token: string, fullName: string, content: string): Promise<string> {
  const data = await ghPost<{ sha: string }>(token, `/repos/${fullName}/git/blobs`, {
    content: Buffer.from(content).toString("base64"),
    encoding: "base64",
  });
  return data.sha;
}

async function createTree(
  token: string,
  fullName: string,
  baseTreeSha: string,
  files: { path: string; content: string }[],
): Promise<string> {
  // Create blobs in parallel then build the tree in one API call
  const entries = await Promise.all(
    files.map(async (f) => ({
      path: f.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: await createBlob(token, fullName, f.content),
    })),
  );
  const data = await ghPost<{ sha: string }>(token, `/repos/${fullName}/git/trees`, {
    base_tree: baseTreeSha,
    tree: entries,
  });
  return data.sha;
}

async function createCommit(
  token: string,
  fullName: string,
  message: string,
  treeSha: string,
  parentSha: string,
): Promise<string> {
  const data = await ghPost<{ sha: string }>(token, `/repos/${fullName}/git/commits`, {
    message,
    tree: treeSha,
    parents: [parentSha],
  });
  return data.sha;
}

async function createOrUpdateBranch(
  token: string,
  fullName: string,
  branchName: string,
  commitSha: string,
): Promise<void> {
  const refPath = `/repos/${fullName}/git/refs/heads/${branchName}`;
  const checkRes = await fetch(`${GITHUB_API}${refPath}`, { headers: ghHeaders(token) });
  if (checkRes.ok) {
    await ghPatch(token, refPath, { sha: commitSha, force: true });
  } else {
    await ghPost(token, `/repos/${fullName}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: commitSha,
    });
  }
}

async function openPullRequest(
  token: string,
  fullName: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<{ number: number; html_url: string }> {
  const owner = fullName.split("/")[0];
  const existing = await ghGet<Array<{ number: number; html_url: string }>>(
    token,
    `/repos/${fullName}/pulls?head=${encodeURIComponent(`${owner}:${head}`)}&state=open`,
  );
  if (existing.length > 0) return existing[0];
  return ghPost(token, `/repos/${fullName}/pulls`, { title, body, head, base });
}

// ─── Package.json patching ────────────────────────────────────────────────────

interface PkgMods {
  scripts: Record<string, string>;
  deps: Record<string, string>;
  devDeps: Record<string, string>;
}

async function patchPackageJson(
  token: string,
  fullName: string,
  mods: PkgMods,
): Promise<string | null> {
  const hasChanges =
    Object.keys(mods.scripts).length +
      Object.keys(mods.deps).length +
      Object.keys(mods.devDeps).length >
    0;
  if (!hasChanges) return null;

  const content = await fetchFileContent(token, fullName, "package.json");
  if (!content) return null;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (Object.keys(mods.scripts).length) {
    pkg.scripts = {
      ...((pkg.scripts as Record<string, string> | undefined) ?? {}),
      ...mods.scripts,
    };
  }
  if (Object.keys(mods.deps).length) {
    pkg.dependencies = {
      ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
      ...mods.deps,
    };
  }
  if (Object.keys(mods.devDeps).length) {
    pkg.devDependencies = {
      ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
      ...mods.devDeps,
    };
  }

  return JSON.stringify(pkg, null, 2) + "\n";
}

// ─── Source file patching ─────────────────────────────────────────────────────

// Inserts importLines after the last existing `import` statement.
// Then for each usageLines entry, inserts lines after the first line containing `after`.
async function patchSourceFile(
  token: string,
  fullName: string,
  filePath: string,
  importLines: string[],
  usageLines: { after: string; lines: string[] }[],
): Promise<string | null> {
  const content = await fetchFileContent(token, fullName, filePath);
  if (!content) return null;

  let lines = content.split("\n");

  if (importLines.length) {
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImportIdx = i;
    }
    lines = [
      ...lines.slice(0, lastImportIdx + 1),
      ...importLines,
      ...lines.slice(lastImportIdx + 1),
    ];
  }

  for (const { after, lines: toAdd } of usageLines) {
    const idx = lines.findIndex((l) => l.includes(after));
    if (idx !== -1) {
      lines = [...lines.slice(0, idx + 1), ...toAdd, ...lines.slice(idx + 1)];
    }
  }

  return lines.join("\n");
}

// ─── File content templates ───────────────────────────────────────────────────

const VITEST_CONFIG = `import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
`;

const SMOKE_TEST = `import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs without error", () => {
    expect(true).toBe(true);
  });
});
`;

const PLAYWRIGHT_CONFIG = `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
`;

const E2E_HOME_SPEC = `import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/./);
});
`;

const CI_WORKFLOW = `name: CI

on:
  push:
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Detect package manager
        id: pm
        run: |
          if [ -f pnpm-lock.yaml ]; then
            echo "name=pnpm"                              >> $GITHUB_OUTPUT
            echo "install=pnpm install --frozen-lockfile" >> $GITHUB_OUTPUT
            echo "run=pnpm run"                           >> $GITHUB_OUTPUT
          elif [ -f yarn.lock ]; then
            echo "name=yarn"                              >> $GITHUB_OUTPUT
            echo "install=yarn install --frozen-lockfile" >> $GITHUB_OUTPUT
            echo "run=yarn"                               >> $GITHUB_OUTPUT
          else
            echo "name=npm"                               >> $GITHUB_OUTPUT
            echo "install=npm ci"                         >> $GITHUB_OUTPUT
            echo "run=npm run"                            >> $GITHUB_OUTPUT
          fi

      - name: Setup pnpm
        if: steps.pm.outputs.name == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: \${{ steps.pm.outputs.name }}

      - name: Install dependencies
        run: \${{ steps.pm.outputs.install }}

      - name: Check scripts
        id: scripts
        run: |
          has() { node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)"; }
          has lint  && echo "lint=true"  >> $GITHUB_OUTPUT || echo "lint=false"  >> $GITHUB_OUTPUT
          has test  && echo "test=true"  >> $GITHUB_OUTPUT || echo "test=false"  >> $GITHUB_OUTPUT
          has build && echo "build=true" >> $GITHUB_OUTPUT || echo "build=false" >> $GITHUB_OUTPUT

      - name: Lint
        if: steps.scripts.outputs.lint == 'true'
        run: \${{ steps.pm.outputs.run }} lint

      - name: Test
        if: steps.scripts.outputs.test == 'true'
        run: \${{ steps.pm.outputs.run }} test

      - name: Build
        if: steps.scripts.outputs.build == 'true'
        run: \${{ steps.pm.outputs.run }} build
`;

const ESLINT_CONFIG = `import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [{
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser },
  plugins: { "@typescript-eslint": tseslint },
}];
`;

const PRETTIER_RC = `{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
`;

const PRETTIER_IGNORE = `node_modules
dist
build
.next
coverage
`;

const DOCKERFILE = `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app ./
CMD ["npm", "start"]
`;

const DOCKER_IGNORE = `node_modules
.git
.env
dist
build
*.log
`;

const VITEST_CONFIG_NODE = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
`;

const DOCKERFILE_NEXTJS = `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
`;

const DOCKERFILE_VITE = `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

const ENV_EXAMPLE = `# Copy to .env and fill in
DATABASE_URL=
NEXTAUTH_SECRET=
STRIPE_SECRET_KEY=
SENTRY_DSN=
`;

const SENTRY_INIT = `import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
`;

const HELMET_MIDDLEWARE = `import helmet from "helmet";
import type { Express } from "express";

export function applyHelmet(app: Express): void {
  app.use(helmet());
}
`;

const RATE_LIMIT_MIDDLEWARE = `import rateLimit from "express-rate-limit";
import type { Express } from "express";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export function applyRateLimit(app: Express): void {
  app.use(limiter);
}
`;

const WINSTON_LOGGER = `import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
`;

const REQUEST_LOGGER_MIDDLEWARE = `import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
}
`;

// ─── Framework-aware content generators ──────────────────────────────────────

function vitestConfig(framework: string): string {
  return framework === "Express" || framework === "unknown" ? VITEST_CONFIG_NODE : VITEST_CONFIG;
}

function dockerfile(framework: string): string {
  if (framework === "Next.js") return DOCKERFILE_NEXTJS;
  if (framework === "Vite" || framework === "React") return DOCKERFILE_VITE;
  return DOCKERFILE; // Express / unknown → node server
}

function pmCommands(pm: string) {
  if (pm === "pnpm")
    return { install: "pnpm install", dev: "pnpm dev", build: "pnpm build", test: "pnpm test" };
  if (pm === "yarn")
    return { install: "yarn", dev: "yarn dev", build: "yarn build", test: "yarn test" };
  if (pm === "bun")
    return { install: "bun install", dev: "bun dev", build: "bun build", test: "bun test" };
  return { install: "npm install", dev: "npm run dev", build: "npm run build", test: "npm test" };
}

// ─── Repo scanning helpers ────────────────────────────────────────────────────

async function detectPackageManager(
  token: string,
  fullName: string,
): Promise<"npm" | "pnpm" | "yarn" | "bun"> {
  const [pnpm, yarn, bun] = await Promise.all([
    fetchFileContent(token, fullName, "pnpm-lock.yaml"),
    fetchFileContent(token, fullName, "yarn.lock"),
    fetchFileContent(token, fullName, "bun.lockb"),
  ]);
  if (pnpm) return "pnpm";
  if (yarn) return "yarn";
  if (bun) return "bun";
  return "npm";
}

const ENV_VAR_SCAN_FILES = [
  "src/index.ts",
  "src/index.js",
  "index.ts",
  "index.js",
  "src/app.ts",
  "src/app.js",
  "app.ts",
  "app.js",
  "src/server.ts",
  "src/server.js",
  "server.ts",
  "server.js",
  "src/config.ts",
  "config.ts",
  "src/env.ts",
  "src/lib/env.ts",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
];

const ENV_VAR_BUILTINS = new Set(["NODE_ENV", "PATH", "HOME", "USER", "PORT", "HOST", "PWD"]);

async function detectEnvVars(token: string, fullName: string): Promise<string[]> {
  const contents = await Promise.all(
    ENV_VAR_SCAN_FILES.map((p) => fetchFileContent(token, fullName, p)),
  );
  const vars = new Set<string>();
  for (const content of contents) {
    if (!content) continue;
    for (const m of content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) vars.add(m[1]);
    for (const m of content.matchAll(/process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]]/g)) vars.add(m[1]);
    for (const m of content.matchAll(/import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g)) vars.add(m[1]);
  }
  return [...vars].filter((v) => !ENV_VAR_BUILTINS.has(v)).sort();
}

// ─── Fix labels (for commit message and PR title) ─────────────────────────────

const FIX_LABEL: Record<string, string> = {
  vitest: "Vitest",
  playwright: "Playwright",
  "github-actions": "GitHub Actions CI",
  eslint: "ESLint",
  prettier: "Prettier",
  dockerfile: "Dockerfile",
  "env-example": ".env.example",
  readme: "README setup",
  monitoring: "Sentry monitoring",
  helmet: "Helmet security headers",
  "rate-limit": "rate limiting",
  logger: "Winston logger",
  "vitest-ai": "AI-generated Vitest tests",
  "playwright-ai": "AI-generated Playwright tests",
  "api-tests": "AI-generated API tests",
};

// ─── File collector ───────────────────────────────────────────────────────────

export interface AiTestFile {
  path: string;
  content: string;
}

export async function collectFixFiles(
  token: string,
  fullName: string,
  fixIds: string[],
  opts?: { framework?: string; repoName?: string; aiFiles?: AiTestFile[] },
): Promise<{ path: string; content: string }[]> {
  const framework = opts?.framework ?? "unknown";
  const repoName = opts?.repoName ?? fullName.split("/")[1] ?? "project";
  const aiFiles = opts?.aiFiles;

  const fileMap = new Map<string, string>();
  const pkgMods: PkgMods = { scripts: {}, deps: {}, devDeps: {} };
  const gitignoreAppends: string[] = [];
  const readmeSections: string[] = [];

  const add = (path: string, content: string) => fileMap.set(path, content);

  for (const fixId of fixIds) {
    switch (fixId) {
      case "vitest":
        add("vitest.config.ts", vitestConfig(framework));
        add("tests/smoke.test.ts", SMOKE_TEST);
        Object.assign(pkgMods.scripts, {
          test: "vitest",
          "test:ui": "vitest --ui",
          "test:coverage": "vitest run --coverage",
        });
        Object.assign(pkgMods.devDeps, { vitest: "^1.6.0", "@vitejs/plugin-react": "^4.3.0" });
        break;

      case "playwright":
        add("playwright.config.ts", PLAYWRIGHT_CONFIG);
        add("e2e/home.spec.ts", E2E_HOME_SPEC);
        Object.assign(pkgMods.devDeps, { "@playwright/test": "^1.47.0" });
        gitignoreAppends.push("/test-results/", "/playwright-report/", "/playwright/.cache/");
        break;

      case "github-actions":
        add(".github/workflows/ci.yml", CI_WORKFLOW);
        break;

      case "eslint":
        add("eslint.config.js", ESLINT_CONFIG);
        Object.assign(pkgMods.scripts, { lint: "eslint ." });
        Object.assign(pkgMods.devDeps, {
          eslint: "^8.57.0",
          "@typescript-eslint/parser": "^7.0.0",
          "@typescript-eslint/eslint-plugin": "^7.0.0",
        });
        break;

      case "prettier":
        add(".prettierrc", PRETTIER_RC);
        add(".prettierignore", PRETTIER_IGNORE);
        Object.assign(pkgMods.scripts, {
          format: 'prettier --write "**/*.{ts,tsx,js,jsx,json,md}"',
        });
        Object.assign(pkgMods.devDeps, { prettier: "^3.3.0" });
        break;

      case "dockerfile":
        add("Dockerfile", dockerfile(framework));
        add(".dockerignore", DOCKER_IGNORE);
        break;

      case "env-example":
        // ENV_EXAMPLE is a placeholder — real content built below after scanning
        readmeSections.push(
          `## Environment variables\n\nCopy \`.env.example\` to \`.env\` and fill in the required values:\n\n\`\`\`bash\ncp .env.example .env\n\`\`\``,
        );
        break;

      case "readme":
        // Readme content built below after detecting package manager
        break;

      case "monitoring":
        add("src/lib/sentry.ts", SENTRY_INIT);
        Object.assign(pkgMods.deps, { "@sentry/react": "^8.0.0" });
        break;

      case "helmet":
        add("src/middleware/security.ts", HELMET_MIDDLEWARE);
        Object.assign(pkgMods.deps, { helmet: "^7.2.0" });
        break;

      case "rate-limit":
        add("src/middleware/rate-limit.ts", RATE_LIMIT_MIDDLEWARE);
        Object.assign(pkgMods.deps, { "express-rate-limit": "^7.4.0" });
        break;

      case "logger":
        add("src/lib/logger.ts", WINSTON_LOGGER);
        add("src/middleware/logging.ts", REQUEST_LOGGER_MIDDLEWARE);
        Object.assign(pkgMods.deps, { winston: "^3.14.0" });
        break;

      case "vitest-ai": {
        const isReact = framework !== "Express" && framework !== "unknown";
        Object.assign(pkgMods.devDeps, {
          vitest: "^1.6.0",
          ...(isReact ? { "@vitejs/plugin-react": "^4.3.0" } : {}),
        });
        Object.assign(pkgMods.scripts, { test: "vitest" });
        if (!fixIds.includes("vitest")) add("vitest.config.ts", vitestConfig(framework));
        break;
      }

      case "playwright-ai":
        Object.assign(pkgMods.devDeps, { "@playwright/test": "^1.47.0" });
        break;

      case "api-tests":
        Object.assign(pkgMods.devDeps, { supertest: "^7.0.0", "@types/supertest": "^6.0.0" });
        break;
    }
  }

  // .env.example — scan repo for actual env vars, fall back to generic template
  if (fixIds.includes("env-example")) {
    const detected = await detectEnvVars(token, fullName);
    const lines =
      detected.length > 0
        ? ["# Copy to .env and fill in", ...detected.map((v) => `${v}=`)]
        : ENV_EXAMPLE.trim().split("\n");
    add(".env.example", lines.join("\n") + "\n");
  }

  // README — detect package manager and use real repo name
  if (fixIds.includes("readme") || readmeSections.length > 0) {
    const pm = await detectPackageManager(token, fullName);
    const cmds = pmCommands(pm);
    if (fixIds.includes("readme")) {
      readmeSections.unshift(
        `## Getting started\n\n**1. Clone and install**\n\n\`\`\`bash\ngit clone https://github.com/<you>/${repoName}.git\ncd ${repoName}\n${cmds.install}\n\`\`\`\n\n**2. Configure environment**\n\n\`\`\`bash\ncp .env.example .env\n\`\`\`\n\nFill in \`.env\` with required variables.\n\n**3. Run in development**\n\n\`\`\`bash\n${cmds.dev}\n\`\`\``,
      );
    }
  }

  // AI-generated file content
  if (aiFiles) {
    for (const f of aiFiles) {
      add(f.path, f.content);
    }
  }

  // Merge all package.json modifications
  const pkgContent = await patchPackageJson(token, fullName, pkgMods);
  if (pkgContent) add("package.json", pkgContent);

  // Append .gitignore entries
  if (gitignoreAppends.length) {
    const current = await fetchFileContent(token, fullName, ".gitignore");
    const base = current ? current.trimEnd() + "\n" : "";
    add(".gitignore", base + gitignoreAppends.join("\n") + "\n");
  }

  // README modifications (deduplicated across fixes)
  if (readmeSections.length) {
    const current = await fetchFileContent(token, fullName, "README.md");
    const base = current ? current.trimEnd() + "\n\n" : "";
    add("README.md", base + readmeSections.join("\n\n") + "\n");
  }

  // src/main.tsx — Sentry import
  if (fixIds.includes("monitoring")) {
    const patched = await patchSourceFile(
      token,
      fullName,
      "src/main.tsx",
      [`import "./lib/sentry";`],
      [],
    );
    if (patched) add("src/main.tsx", patched);
  }

  // src/index.ts — Express middleware imports + usage
  const indexImports: string[] = [];
  const indexUsages: { after: string; lines: string[] }[] = [];

  if (fixIds.includes("helmet")) {
    indexImports.push(`import { applyHelmet } from "./middleware/security";`);
    indexUsages.push({ after: "const app = express()", lines: ["applyHelmet(app);"] });
  }
  if (fixIds.includes("rate-limit")) {
    indexImports.push(`import { applyRateLimit } from "./middleware/rate-limit";`);
    indexUsages.push({ after: "const app = express()", lines: ["applyRateLimit(app);"] });
  }
  if (fixIds.includes("logger")) {
    indexImports.push(`import { requestLogger } from "./middleware/logging";`);
    indexUsages.push({ after: "const app = express()", lines: ["app.use(requestLogger);"] });
  }

  if (indexImports.length) {
    const patched = await patchSourceFile(
      token,
      fullName,
      "src/index.ts",
      indexImports,
      indexUsages,
    );
    if (patched) add("src/index.ts", patched);
  }

  return [...fileMap.entries()].map(([path, content]) => ({ path, content }));
}

// ─── PR creation from pre-generated files ────────────────────────────────────

export async function createPRFromFiles(
  token: string,
  repoFullName: string,
  defaultBranch: string,
  branchName: string,
  fixIds: string[],
  files: { path: string; content: string }[],
): Promise<{ prNumber: number; prUrl: string }> {
  if (!files.length) throw new Error("No files to commit.");

  const refData = await ghGet<{ object: { sha: string } }>(
    token,
    `/repos/${repoFullName}/git/ref/heads/${defaultBranch}`,
  );
  const baseSha = refData.object.sha;

  const commitData = await ghGet<{ tree: { sha: string } }>(
    token,
    `/repos/${repoFullName}/git/commits/${baseSha}`,
  );
  const baseTreeSha = commitData.tree.sha;

  const newTreeSha = await createTree(token, repoFullName, baseTreeSha, files);

  const labels = fixIds.map((id) => FIX_LABEL[id] ?? id);
  const commitMessage = `chore: add production setup\n\nAdded: ${labels.join(", ")}\n\nGenerated by LaunchReadyy`;
  const newCommitSha = await createCommit(token, repoFullName, commitMessage, newTreeSha, baseSha);

  await createOrUpdateBranch(token, repoFullName, branchName, newCommitSha);

  const titleSuffix =
    fixIds.length > 3
      ? `${fixIds
          .slice(0, 3)
          .map((id) => FIX_LABEL[id] ?? id)
          .join(", ")} +${fixIds.length - 3} more`
      : labels.join(", ");

  const prBody = [
    `## Production setup added by LaunchReadyy`,
    ``,
    `**Fixes applied:** ${labels.join(", ")}`,
    ``,
    `**Files changed:** ${files.length} file${files.length !== 1 ? "s" : ""}`,
    ``,
    `<details><summary>Files</summary>`,
    ``,
    files.map((f) => `- \`${f.path}\``).join("\n"),
    ``,
    `</details>`,
    ``,
    `---`,
    `_Generated by [LaunchReadyy](https://launchreadyy.com)_`,
  ].join("\n");

  const pr = await openPullRequest(
    token,
    repoFullName,
    branchName,
    defaultBranch,
    `chore: add production setup (${titleSuffix})`,
    prBody,
  );

  return { prNumber: pr.number, prUrl: pr.html_url };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function executeFixJob(
  token: string,
  repoFullName: string,
  defaultBranch: string,
  branchName: string,
  fixIds: string[],
  opts?: { framework?: string; repoName?: string; aiFiles?: AiTestFile[] },
): Promise<{ prNumber: number; prUrl: string }> {
  const files = await collectFixFiles(token, repoFullName, fixIds, opts);
  return createPRFromFiles(token, repoFullName, defaultBranch, branchName, fixIds, files);
}

// ─── Preview diff computation ─────────────────────────────────────────────────

type DiffLineType = "add" | "del" | "ctx" | "hunk";

export interface PreviewDiffLine {
  type: DiffLineType;
  text: string;
  oldNo?: number;
  newNo?: number;
}

export interface PreviewFileDiff {
  path: string;
  status: "added" | "modified";
  lines: PreviewDiffLine[];
}

interface AnnotatedOp {
  type: "eq" | "add" | "del";
  line: string;
  oldNo: number;
  newNo: number;
}

function lcsOps(a: string[], b: string[]): AnnotatedOp[] {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const raw: { type: "eq" | "add" | "del"; line: string }[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.unshift({ type: "eq", line: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "add", line: b[j - 1] });
      j--;
    } else {
      raw.unshift({ type: "del", line: a[i - 1] });
      i--;
    }
  }

  let oldNo = 0,
    newNo = 0;
  return raw.map((op) => {
    if (op.type !== "add") oldNo++;
    if (op.type !== "del") newNo++;
    return { ...op, oldNo: op.type === "add" ? 0 : oldNo, newNo: op.type === "del" ? 0 : newNo };
  });
}

function opsToPreviewLines(ops: AnnotatedOp[], context = 3): PreviewDiffLine[] {
  const changedIdxs = ops.map((op, i) => (op.type !== "eq" ? i : -1)).filter((i) => i >= 0);
  if (changedIdxs.length === 0) return [];

  const ranges: [number, number][] = [];
  for (const idx of changedIdxs) {
    const s = Math.max(0, idx - context);
    const e = Math.min(ops.length - 1, idx + context);
    if (ranges.length === 0 || s > ranges[ranges.length - 1][1] + 1) {
      ranges.push([s, e]);
    } else {
      ranges[ranges.length - 1][1] = Math.max(ranges[ranges.length - 1][1], e);
    }
  }

  const result: PreviewDiffLine[] = [];
  for (const [s, e] of ranges) {
    let oldCount = 0,
      newCount = 0;
    for (let k = s; k <= e; k++) {
      if (ops[k].type !== "add") oldCount++;
      if (ops[k].type !== "del") newCount++;
    }
    // Old/new starting line numbers for this hunk
    let oldStart = 0,
      newStart = 0;
    for (let k = 0; k < s; k++) {
      if (ops[k].type !== "add") oldStart = ops[k].oldNo;
      if (ops[k].type !== "del") newStart = ops[k].newNo;
    }
    oldStart += 1;
    newStart += 1;

    result.push({ type: "hunk", text: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@` });

    for (let k = s; k <= e; k++) {
      const op = ops[k];
      if (op.type === "eq") {
        result.push({ type: "ctx", text: op.line, oldNo: op.oldNo, newNo: op.newNo });
      } else if (op.type === "add") {
        result.push({ type: "add", text: op.line, newNo: op.newNo });
      } else {
        result.push({ type: "del", text: op.line, oldNo: op.oldNo });
      }
    }
  }
  return result;
}

function newFileDiffLines(content: string): PreviewDiffLine[] {
  const lines = content.trimEnd().split("\n");
  const result: PreviewDiffLine[] = [{ type: "hunk", text: `@@ -0,0 +1,${lines.length} @@` }];
  lines.forEach((line, i) => result.push({ type: "add", text: line, newNo: i + 1 }));
  return result;
}

// Compute diffs from already-generated files (used when fix_cache is hit).
export async function computeDiffsFromFiles(
  token: string,
  fullName: string,
  proposed: { path: string; content: string }[],
): Promise<PreviewFileDiff[]> {
  const diffs = await Promise.all(
    proposed.map(async ({ path, content }) => {
      const original = await fetchFileContent(token, fullName, path);
      if (!original) {
        return { path, status: "added" as const, lines: newFileDiffLines(content) };
      }
      const oldLines = original.trimEnd().split("\n");
      const newLines = content.trimEnd().split("\n");
      const ops = lcsOps(oldLines, newLines);
      const lines = opsToPreviewLines(ops);
      return {
        path,
        status: "modified" as const,
        lines: lines.length > 0 ? lines : newFileDiffLines(content),
      };
    }),
  );
  return diffs.filter((d) => d.lines.length > 0);
}

export async function computePreviewDiffs(
  token: string,
  fullName: string,
  fixIds: string[],
  opts?: { framework?: string; repoName?: string },
): Promise<PreviewFileDiff[]> {
  const proposed = await collectFixFiles(token, fullName, fixIds, opts);
  return computeDiffsFromFiles(token, fullName, proposed);
}
