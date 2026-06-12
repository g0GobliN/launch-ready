// Implements real PR creation via the GitHub Trees API.
// Replaces the fake sleep + random PR number in runFixJob.

import { buildReadmeSections } from "./readme-setup";
import { githubContentsPath, githubHeadRefPath } from "./github.server";

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

function gitWriteHint(
  status: number,
  path: string,
  scopes: string | null,
  committedCount = 0,
): string {
  if (status !== 404) return "";
  if (!path.includes("/git/") && !path.includes("/contents/")) return "";
  const scopeNote = scopes ? ` OAuth scopes: ${scopes}.` : "";
  const hasRepo = scopes?.split(",").some((s) => s.trim() === "repo");
  if (hasRepo || committedCount > 0) {
    return (
      " GitHub rejected this write — check nested file paths or whether the branch has a partial commit." +
      scopeNote
    );
  }
  return (
    " This usually means your GitHub token lacks write access — sign out and reconnect " +
    `with the "repo" scope.${scopeNote}`
  );
}

async function ghPost<T>(
  token: string,
  path: string,
  body: unknown,
  opts?: { committedCount?: number },
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = gitWriteHint(
      res.status,
      path,
      res.headers.get("x-oauth-scopes"),
      opts?.committedCount,
    );
    throw new Error(`GitHub POST ${path} → ${res.status}: ${text.slice(0, 300)}${hint}`);
  }
  return res.json() as Promise<T>;
}

async function ghPut<T>(
  token: string,
  path: string,
  body: unknown,
  opts?: { committedCount?: number },
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "PUT",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = gitWriteHint(
      res.status,
      path,
      res.headers.get("x-oauth-scopes"),
      opts?.committedCount,
    );
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${text.slice(0, 300)}${hint}`);
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

function contentsApiPath(filePath: string): string {
  return githubContentsPath(filePath);
}

function headRefPath(fullName: string, branchName: string): string {
  return githubHeadRefPath(fullName, branchName);
}

async function ensureBranch(
  token: string,
  fullName: string,
  branchName: string,
  baseSha: string,
): Promise<void> {
  const refPath = headRefPath(fullName, branchName);
  const checkRes = await fetch(`${GITHUB_API}${refPath}`, { headers: ghHeaders(token) });
  if (checkRes.ok) return;
  if (checkRes.status !== 404) {
    const text = await checkRes.text().catch(() => "");
    throw new Error(
      `Cannot access branch ${branchName} on ${fullName} (${checkRes.status}): ${text.slice(0, 200)}`,
    );
  }
  await ghPost(token, `/repos/${fullName}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });
  const verify = await fetch(`${GITHUB_API}${refPath}`, { headers: ghHeaders(token) });
  if (!verify.ok) {
    throw new Error(
      `Failed to create branch ${branchName} on ${fullName} — cannot commit files without it.`,
    );
  }
}

// ─── Git Trees API (primary — atomic single commit) ───────────────────────────

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
  const refPath = headRefPath(fullName, branchName);
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

/** Contents API fallback — one commit per file; used only if Trees API fails. */
async function commitFilesViaContentsApi(
  token: string,
  fullName: string,
  branchName: string,
  files: { path: string; content: string }[],
  commitMessage: string,
): Promise<void> {
  let committedCount = 0;
  for (const file of files) {
    const path = file.path.replace(/^\/+/, "");
    const apiPath = `/repos/${fullName}/contents/${contentsApiPath(path)}`;

    let sha: string | undefined;
    try {
      const existing = await ghGet<{ sha: string }>(
        token,
        `${apiPath}?ref=${encodeURIComponent(branchName)}`,
      );
      sha = existing.sha;
    } catch {
      // new file
    }

    try {
      await ghPut(
        token,
        apiPath,
        {
          message: commitMessage,
          content: Buffer.from(file.content, "utf8").toString("base64"),
          branch: branchName,
          ...(sha ? { sha } : {}),
        },
        { committedCount },
      );
      committedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") && msg.includes("/contents/")) {
        const partial =
          committedCount > 0
            ? ` Branch ${branchName} may have a partial commit (${committedCount} file(s) written).`
            : "";
        throw new Error(
          `Failed writing ${path} on branch ${branchName}.${partial} ${msg}`,
        );
      }
      throw err;
    }
  }
}

async function fetchFileContent(
  token: string,
  fullName: string,
  path: string,
): Promise<string | null> {
  try {
    const data = await ghGet<{ content?: string; encoding?: string }>(
      token,
      `/repos/${fullName}/contents/${contentsApiPath(path)}`,
    );
    if (!data.content || data.encoding !== "base64") return null;
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  } catch {
    return null;
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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["node_modules", "dist", "e2e", "**/*.config.*", "**/*.d.ts"],
    },
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

function ciWorkflow(nodeVersion: string): string {
  return `name: CI

on:
  push:
    branches: [main, master, develop]
  pull_request:

env:
  NODE_VERSION: '${nodeVersion}'

jobs:
  # ── 1. Install & cache node_modules ─────────────────────────────────────
  install:
    name: Install
    runs-on: ubuntu-latest
    outputs:
      pm:  \${{ steps.pm.outputs.name }}
      run: \${{ steps.pm.outputs.run }}
    steps:
      - uses: actions/checkout@v4

      - id: pm
        name: Detect package manager
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

      - if: steps.pm.outputs.name == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: \${{ steps.pm.outputs.name }}

      - id: cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: nm-\${{ runner.os }}-\${{ hashFiles('**/package-lock.json','**/pnpm-lock.yaml','**/yarn.lock') }}
          restore-keys: nm-\${{ runner.os }}-

      - if: steps.cache.outputs.cache-hit != 'true'
        run: \${{ steps.pm.outputs.install }}

  # ── 2a. Lint + Typecheck (parallel with test) ────────────────────────────
  check:
    name: Lint & Typecheck
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - if: needs.install.outputs.pm == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: node_modules
          key: nm-\${{ runner.os }}-\${{ hashFiles('**/package-lock.json','**/pnpm-lock.yaml','**/yarn.lock') }}
      - id: s
        run: |
          has() { node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)"; }
          has lint      && echo "lint=true"      >> $GITHUB_OUTPUT || echo "lint=false"      >> $GITHUB_OUTPUT
          has typecheck && echo "typecheck=true" >> $GITHUB_OUTPUT || echo "typecheck=false" >> $GITHUB_OUTPUT
      - if: steps.s.outputs.lint == 'true'
        run: \${{ needs.install.outputs.run }} lint
      - if: steps.s.outputs.typecheck == 'true'
        run: \${{ needs.install.outputs.run }} typecheck

  # ── 2b. Test (parallel with check) ──────────────────────────────────────
  test:
    name: Test
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - if: needs.install.outputs.pm == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: node_modules
          key: nm-\${{ runner.os }}-\${{ hashFiles('**/package-lock.json','**/pnpm-lock.yaml','**/yarn.lock') }}
      - id: s
        run: |
          has() { node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)"; }
          has test && echo "test=true" >> $GITHUB_OUTPUT || echo "test=false" >> $GITHUB_OUTPUT
      - if: steps.s.outputs.test == 'true'
        run: \${{ needs.install.outputs.run }} test

  # ── 3. Build (after check + test pass) ──────────────────────────────────
  build:
    name: Build
    needs: [install, check, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - if: needs.install.outputs.pm == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: node_modules
          key: nm-\${{ runner.os }}-\${{ hashFiles('**/package-lock.json','**/pnpm-lock.yaml','**/yarn.lock') }}
      - id: s
        run: |
          has() { node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)"; }
          has build && echo "build=true" >> $GITHUB_OUTPUT || echo "build=false" >> $GITHUB_OUTPUT
      - if: steps.s.outputs.build == 'true'
        run: \${{ needs.install.outputs.run }} build
      - if: steps.s.outputs.build == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist
          retention-days: 7
          if-no-files-found: ignore
`;
}

const ESLINT_CONFIG = `import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [{
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser },
  plugins: { "@typescript-eslint": tseslint },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    eqeqeq: ["error", "always"],
  },
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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Non-root user for security
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["npm", "start"]
`;

const DOCKER_IGNORE = `node_modules
.git
.env
.env.*
dist
build
coverage
tests
e2e
.github
*.log
*.md
Dockerfile*
`;


const VITEST_CONFIG_NODE = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["node_modules", "dist", "**/*.config.*", "**/*.d.ts"],
    },
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
# Non-root user for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
`;

const DOCKERFILE_VITE = `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# Non-root nginx
RUN addgroup -S web && adduser -S web -G web
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R web:web /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
`;

const ENV_EXAMPLE = `# Copy to .env and fill in
DATABASE_URL=
NEXTAUTH_SECRET=
STRIPE_SECRET_KEY=
SENTRY_DSN=
`;

const ERROR_BOUNDARY_TSX = `'use client'

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p>Please try again or contact support if the problem persists.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  )
}
`;

const SENTRY_INIT = `import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  beforeSend(event) {
    // Drop noisy network errors from browser extensions
    if (event.exception?.values?.[0]?.value?.includes("Extension context")) return null;
    return event;
  },
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

// ─── Next.js standalone config ───────────────────────────────────────────────

const NEXT_CONFIG_STANDALONE = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
`;

// Patches an existing next.config file to add output: "standalone".
// Returns null if the config already has it (no change needed).
function patchNextConfigStandalone(content: string): string | null {
  if (/output\s*:\s*["']standalone["']/.test(content)) return null;
  const insertAt = content.search(/(?:=\s*\{|export\s+default\s*\{)/);
  if (insertAt === -1) return null;
  const braceIdx = content.indexOf("{", insertAt);
  if (braceIdx === -1) return null;
  return content.slice(0, braceIdx + 1) + '\n  output: "standalone",' + content.slice(braceIdx + 1);
}

// ─── Sentry templates ─────────────────────────────────────────────────────────

const SENTRY_INIT_NEXTJS = `import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
});
`;

const SENTRY_INSTRUMENTATION_NEXTJS = `export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./src/lib/sentry");
  }
}
`;

const SENTRY_ERROR_BOUNDARY_TSX = `import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";

export function SentryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "An unexpected error occurred"}
            </p>
            <button
              className="mt-4 text-sm text-primary underline"
              onClick={resetError}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
`;

const SENTRY_INIT_PYTHON = `import sentry_sdk
import os

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    environment=os.environ.get("ENVIRONMENT", "production"),
    release=os.environ.get("APP_VERSION"),
    traces_sample_rate=0.1 if os.environ.get("ENVIRONMENT") == "production" else 0.0,
)
`;

const SENTRY_INIT_RUBY = `Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.environment = ENV.fetch("RAILS_ENV", "production")
  config.release = ENV["APP_VERSION"]
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = ENV["RAILS_ENV"] == "production" ? 0.1 : 0.0
end
`;

const SENTRY_INIT_GO = `package sentry

import (
\t"os"

\t"github.com/getsentry/sentry-go"
)

func Init() error {
\treturn sentry.Init(sentry.ClientOptions{
\t\tDsn:              os.Getenv("SENTRY_DSN"),
\t\tEnvironment:      os.Getenv("APP_ENV"),
\t\tRelease:          os.Getenv("APP_VERSION"),
\t\tTracesSampleRate: 0.1,
\t})
}
`;

const SENTRY_INIT_JAVA = `# Add to src/main/resources/application.properties
sentry.dsn=\${SENTRY_DSN}
sentry.traces-sample-rate=0.1
sentry.environment=\${SPRING_PROFILES_ACTIVE:production}
`;

const SENTRY_INIT_PHP = `<?php

return [
    'dsn' => env('SENTRY_LARAVEL_DSN', env('SENTRY_DSN')),
    'environment' => env('APP_ENV', 'production'),
    'release' => env('APP_VERSION'),
    'traces_sample_rate' => env('APP_ENV') === 'production' ? 0.1 : 0.0,
    'breadcrumbs' => [
        'logs' => true,
        'sql_queries' => true,
        'queue_info' => true,
    ],
];
`;

const SENTRY_INIT_RUST = `use std::env;

pub fn init() -> sentry::ClientInitGuard {
    sentry::init((
        env::var("SENTRY_DSN").unwrap_or_default(),
        sentry::ClientOptions {
            release: sentry::release_name!(),
            environment: Some(
                env::var("APP_ENV")
                    .unwrap_or_else(|_| "production".into())
                    .into(),
            ),
            traces_sample_rate: 0.1,
            ..Default::default()
        },
    ))
}
`;

// ─── Entry-point detection ────────────────────────────────────────────────────

const EXPRESS_ENTRY_CANDIDATES = [
  "src/index.ts",
  "src/index.js",
  "index.ts",
  "index.js",
  "src/server.ts",
  "src/server.js",
  "server.ts",
  "server.js",
  "src/app.ts",
  "src/app.js",
  "app.ts",
  "app.js",
];

const REACT_VITE_ENTRY_CANDIDATES = [
  "src/main.tsx",
  "src/main.ts",
  "src/index.tsx",
  "src/index.ts",
  "main.tsx",
  "main.ts",
  // TanStack Start — router.tsx runs on both client and server
  "src/router.tsx",
  "src/router.ts",
];

async function detectEntryPoint(
  token: string,
  fullName: string,
  framework: string,
): Promise<string | null> {
  const candidates =
    framework === "Express" ? EXPRESS_ENTRY_CANDIDATES : REACT_VITE_ENTRY_CANDIDATES;
  for (const candidate of candidates) {
    const content = await fetchFileContent(token, fullName, candidate);
    if (content !== null) return candidate;
  }
  return null;
}

// ─── Framework-aware content generators ──────────────────────────────────────

function vitestConfig(framework: string): string {
  return framework === "Express" || framework === "unknown" ? VITEST_CONFIG_NODE : VITEST_CONFIG;
}

function dockerfile(framework: string): string {
  if (framework === "Next.js") return DOCKERFILE_NEXTJS;
  if (framework === "Vite" || framework === "React") return DOCKERFILE_VITE;
  return DOCKERFILE; // Express / unknown → node server
}

// ─── Repo scanning helpers ────────────────────────────────────────────────────

const BACKEND_DEPS = ["express", "fastify", "koa", "hapi", "@hapi/hapi", "nestjs", "@nestjs/core", "restify", "polka", "h3"];

interface PackageJsonMeta {
  scripts: Record<string, string>;
  nodeVersion: string;
  hasBackend: boolean;
}

async function fetchPackageJsonMeta(token: string, fullName: string): Promise<PackageJsonMeta> {
  const content = await fetchFileContent(token, fullName, "package.json");
  if (!content) return { scripts: {}, nodeVersion: "20", hasBackend: false };
  try {
    const pkg = JSON.parse(content) as {
      scripts?: Record<string, string>;
      engines?: { node?: string };
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const rawNode = pkg.engines?.node ?? "20";
    const nodeVersion = rawNode.match(/\d+/)?.[0] ?? "20";
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasBackend = BACKEND_DEPS.some((d) => d in allDeps);
    return { scripts: pkg.scripts ?? {}, nodeVersion, hasBackend };
  } catch {
    return { scripts: {}, nodeVersion: "20", hasBackend: false };
  }
}

function nginxConf(hasBackend: boolean): string {
  const proxyBlock = hasBackend
    ? `
  # Proxy API requests to the backend service
  location /api/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    client_max_body_size 50M;
  }
`
    : "";

  return `server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header Referrer-Policy "strict-origin-when-cross-origin";
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()";

  # Compression
  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  # Long-term cache for hashed static assets
  location ~* \\.(js|css|png|jpg|svg|ico|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
${proxyBlock}
  # SPA fallback — all routes served by index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
`;
}

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
  readme: "Setup documentation",
  "error-boundary": "error boundary",
  monitoring: "Sentry monitoring",
  helmet: "Helmet security headers",
  "rate-limit": "rate limiting",
  logger: "Winston logger",
  "ci-ai": "AI-tailored GitHub Actions CI",
  "readme-ai": "AI-written setup docs",
  "env-example-ai": "AI-scanned .env.example",
  "vitest-ai": "AI-generated Vitest tests",
  "playwright-ai": "AI-generated Playwright tests",
  "api-tests": "AI-generated API tests",
};

const FIX_WHY: Record<string, string> = {
  monitoring: "You'll know about crashes before your users do. Every unhandled error gets captured with a full stack trace, environment, and release — so you can ship with confidence.",
  vitest: "Every push is now verified. Fast unit tests run in CI so bugs don't reach main.",
  "vitest-ai": "AI-written tests cover your real components and logic — not boilerplate.",
  playwright: "Broken user flows get caught before users hit them.",
  "playwright-ai": "AI-written E2E tests cover your actual routes and interactions.",
  "github-actions": "Every push now runs lint, typecheck, and tests automatically.",
  "ci-ai": "CI workflow tailored to your framework, package manager, and scripts.",
  "readme-ai": "Setup docs written for your actual repo name, stack, and scripts.",
  "env-example-ai": "Env vars scanned from your codebase with descriptions for each.",
  eslint: "Catches bugs and enforces consistent style across the codebase.",
  dockerfile: "Reproducible builds everywhere — local, CI, and production.",
  "env-example": "New contributors can run the app without asking what env vars are needed.",
  readme: "Anyone can clone and run the project in minutes.",
  helmet: "Secure HTTP headers protect against XSS, clickjacking, and other common attacks.",
  "rate-limit": "Brute-force and denial-of-service attacks are now blocked at the edge.",
  logger: "Production issues are debuggable. Every request is logged with method, status, and latency.",
  "api-tests": "Your API endpoints are verified — regressions get caught before deploy.",
};

// ─── File collector ───────────────────────────────────────────────────────────

export interface VerificationNote {
  fixId: string;
  status: "verified" | "warning";
  note: string;
}

export interface CollectResult {
  files: { path: string; content: string }[];
  verificationNotes: VerificationNote[];
}

export interface AiTestFile {
  path: string;
  content: string;
}

export async function collectFixFiles(
  token: string,
  fullName: string,
  fixIds: string[],
  opts?: { framework?: string; repoName?: string; aiFiles?: AiTestFile[] },
): Promise<CollectResult> {
  const framework = opts?.framework ?? "unknown";
  const repoName = opts?.repoName ?? fullName.split("/")[1] ?? "project";
  const aiFiles = opts?.aiFiles;

  const fileMap = new Map<string, string>();
  const pkgMods: PkgMods = { scripts: {}, deps: {}, devDeps: {} };
  const gitignoreAppends: string[] = [];
  const readmeSections: string[] = [];
  const verificationNotes: VerificationNote[] = [];

  const add = (path: string, content: string) => fileMap.set(path, content);
  const note = (fixId: string, status: "verified" | "warning", text: string) =>
    verificationNotes.push({ fixId, status, note: text });

  // Pre-fetch package metadata + package manager once for all fixes that need them
  const needsPkgMeta = fixIds.some((id) =>
    ["github-actions", "ci-ai", "readme", "readme-ai", "env-example", "env-example-ai"].includes(id),
  );
  const [pkgMeta, pm] = needsPkgMeta
    ? await Promise.all([
        fetchPackageJsonMeta(token, fullName),
        detectPackageManager(token, fullName),
      ])
    : [
        { scripts: {}, nodeVersion: "20" } as PackageJsonMeta,
        "npm" as "npm" | "pnpm" | "yarn" | "bun",
      ];

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
        Object.assign(pkgMods.devDeps, { vitest: "^3.0.0", "@vitejs/plugin-react": "^5.0.0" });
        break;

      case "playwright":
        add("playwright.config.ts", PLAYWRIGHT_CONFIG);
        add("e2e/home.spec.ts", E2E_HOME_SPEC);
        Object.assign(pkgMods.devDeps, { "@playwright/test": "^1.47.0" });
        gitignoreAppends.push("/test-results/", "/playwright-report/", "/playwright/.cache/");
        break;

      case "github-actions": {
        // .nvmrc takes precedence over engines.node; both beat our default of 20
        const nvmrc = await fetchFileContent(token, fullName, ".nvmrc");
        const nodeVersion = nvmrc
          ? (nvmrc.trim().replace(/^v/, "").match(/\d+/)?.[0] ?? pkgMeta.nodeVersion)
          : pkgMeta.nodeVersion;

        // Ensure a typecheck script exists — add tsc --noEmit if missing
        const hasTypecheck = "typecheck" in pkgMeta.scripts;
        if (!hasTypecheck) pkgMods.scripts.typecheck = "tsc --noEmit";

        add(".github/workflows/ci.yml", ciWorkflow(nodeVersion));

        const nodeSource = nvmrc
          ? ".nvmrc"
          : pkgMeta.nodeVersion !== "20"
            ? "engines.node"
            : "default";
        note(
          "github-actions",
          "verified",
          `Node ${nodeVersion} (${nodeSource}) · ${hasTypecheck ? "typecheck script detected" : "typecheck script added to package.json"}`,
        );
        break;
      }

      case "ci-ai": {
        const nvmrc = await fetchFileContent(token, fullName, ".nvmrc");
        const nodeVersion = nvmrc
          ? (nvmrc.trim().replace(/^v/, "").match(/\d+/)?.[0] ?? pkgMeta.nodeVersion)
          : pkgMeta.nodeVersion;
        const hasTypecheck = "typecheck" in pkgMeta.scripts;
        if (!hasTypecheck) pkgMods.scripts.typecheck = "tsc --noEmit";
        note("ci-ai", "verified", `AI CI workflow · Node ${nodeVersion}`);
        break;
      }

      case "readme-ai":
      case "env-example-ai":
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

      case "dockerfile": {
        add("Dockerfile", dockerfile(framework));
        add(".dockerignore", DOCKER_IGNORE);

        if (framework === "Next.js") {
          // Standalone Dockerfile requires output: "standalone" in next.config — patch or create it
          let configPatched = false;
          for (const configPath of ["next.config.ts", "next.config.js", "next.config.mjs"]) {
            const existing = await fetchFileContent(token, fullName, configPath);
            if (existing !== null) {
              const patched = patchNextConfigStandalone(existing);
              if (patched !== null) {
                add(configPath, patched);
                note("dockerfile", "verified", `${configPath} patched: output: "standalone" added`);
              } else {
                note("dockerfile", "verified", `${configPath} already has output: "standalone"`);
              }
              configPatched = true;
              break;
            }
          }
          if (!configPatched) {
            add("next.config.ts", NEXT_CONFIG_STANDALONE);
            note("dockerfile", "verified", `next.config.ts created with output: "standalone"`);
          }
        } else if (framework === "Vite" || framework === "React") {
          add("nginx.conf", nginxConf(pkgMeta.hasBackend));
          note("dockerfile", "verified", `nginx Dockerfile added${pkgMeta.hasBackend ? " with /api/ proxy" : ""}`);
        } else {
          note("dockerfile", "verified", "Node.js server Dockerfile added");
        }
        break;
      }

      case "env-example":
        // .env.example content built below after env var scan
        break;

      case "readme":
        // Readme content built below after detecting package manager
        break;

      case "error-boundary":
        if (framework === "Next.js") add("app/error.tsx", ERROR_BOUNDARY_TSX);
        break;

      case "monitoring":
        if (framework === "Next.js") {
          add("src/lib/sentry.ts", SENTRY_INIT_NEXTJS);
          Object.assign(pkgMods.deps, { "@sentry/nextjs": "^8.0.0" });
        } else if (framework === "Python") {
          add("src/sentry.py", SENTRY_INIT_PYTHON);
        } else if (framework === "Ruby") {
          add("config/initializers/sentry.rb", SENTRY_INIT_RUBY);
        } else if (framework === "Go") {
          add("internal/sentry/sentry.go", SENTRY_INIT_GO);
        } else if (framework === "Java") {
          add("sentry.properties", SENTRY_INIT_JAVA);
        } else if (framework === "PHP") {
          add("config/sentry.php", SENTRY_INIT_PHP);
        } else if (framework === "Rust") {
          add("src/sentry.rs", SENTRY_INIT_RUST);
        } else {
          // Vite / React / Express / unknown JS
          add("src/lib/sentry.ts", SENTRY_INIT);
          add("src/lib/sentry-error-boundary.tsx", SENTRY_ERROR_BOUNDARY_TSX);
          Object.assign(pkgMods.deps, { "@sentry/react": "^8.0.0" });
        }
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
          vitest: "^3.0.0",
          ...(isReact ? { "@vitejs/plugin-react": "^5.0.0" } : {}),
        });
        Object.assign(pkgMods.scripts, { test: "vitest" });
        if (!fixIds.includes("vitest")) add("vitest.config.ts", vitestConfig(framework));
        break;
      }

      case "playwright-ai":
        Object.assign(pkgMods.devDeps, { "@playwright/test": "^1.47.0" });
        if (!fixIds.includes("playwright")) add("playwright.config.ts", PLAYWRIGHT_CONFIG);
        gitignoreAppends.push("/test-results/", "/playwright-report/", "/playwright/.cache/");
        break;

      case "api-tests":
        Object.assign(pkgMods.devDeps, { supertest: "^7.0.0", "@types/supertest": "^6.0.0" });
        break;
    }
  }

  const needsEnvExample = fixIds.includes("env-example") && !fixIds.includes("env-example-ai");
  const detectedEnvVars = needsEnvExample ? await detectEnvVars(token, fullName) : [];

  // .env.example — scan repo for actual env vars, fall back to generic template
  if (needsEnvExample) {
    const lines =
      detectedEnvVars.length > 0
        ? ["# Copy to .env and fill in", ...detectedEnvVars.map((v) => `${v}=`)]
        : ENV_EXAMPLE.trim().split("\n");
    add(".env.example", lines.join("\n") + "\n");
  }

  // Sentry — patch dependency manifests and .env.example for non-JS languages
  if (fixIds.includes("monitoring")) {
    const sentryDsnVar =
      framework === "Next.js" ? "SENTRY_DSN" :
      framework === "Vite" || framework === "React" ? "VITE_SENTRY_DSN" :
      "SENTRY_DSN";

    // Append DSN key to .env.example if it exists (and we haven't already added it)
    if (!needsEnvExample) {
      const existingEnv = await fetchFileContent(token, fullName, ".env.example").catch(() => null);
      if (existingEnv && !existingEnv.includes("SENTRY")) {
        add(".env.example", existingEnv.trimEnd() + `\n${sentryDsnVar}=\n`);
      }
    }

    // Patch language-specific dependency manifests
    if (framework === "Python") {
      const req = await fetchFileContent(token, fullName, "requirements.txt").catch(() => null);
      if (req && !req.includes("sentry-sdk")) {
        add("requirements.txt", req.trimEnd() + "\nsentry-sdk\n");
      } else if (!req) {
        add("requirements.txt", "sentry-sdk\n");
      }
    } else if (framework === "Ruby") {
      const gemfile = await fetchFileContent(token, fullName, "Gemfile").catch(() => null);
      if (gemfile && !gemfile.includes("sentry-ruby")) {
        add("Gemfile", gemfile.trimEnd() + '\ngem "sentry-ruby"\ngem "sentry-rails"\n');
      }
    } else if (framework === "Rust") {
      const cargo = await fetchFileContent(token, fullName, "Cargo.toml").catch(() => null);
      if (cargo && !cargo.includes("sentry")) {
        const patched = cargo.replace(
          /(\[dependencies\][^\[]*)/,
          '$1sentry = { version = "0.34", features = ["debug-images"] }\n',
        );
        if (patched !== cargo) add("Cargo.toml", patched);
      }
    } else if (framework === "PHP") {
      const composer = await fetchFileContent(token, fullName, "composer.json").catch(() => null);
      if (composer && !composer.includes("sentry/sentry")) {
        try {
          const obj = JSON.parse(composer) as Record<string, unknown>;
          const require = (obj["require"] as Record<string, string> | undefined) ?? {};
          require["sentry/sentry-laravel"] = "^4.0";
          obj["require"] = require;
          add("composer.json", JSON.stringify(obj, null, 4) + "\n");
        } catch { /* leave unchanged if parse fails */ }
      }
    }
  }

  // README — repo-specific setup docs (package manager, scripts, env vars)
  const needsReadme = fixIds.includes("readme") && !fixIds.includes("readme-ai");
  const needsEnvOnlyReadme = needsEnvExample && !needsReadme && !fixIds.includes("readme-ai");
  if (needsReadme || needsEnvOnlyReadme) {
    const envVars = needsEnvExample ? detectedEnvVars : [];

    if (needsReadme) {
      readmeSections.push(
        ...buildReadmeSections({
          fullName,
          repoName,
          framework,
          packageManager: pm,
          scripts: pkgMeta.scripts,
          nodeVersion: pkgMeta.nodeVersion,
          envVars,
          withEnvStep: needsEnvExample,
        }),
      );
    } else if (needsEnvOnlyReadme) {
      readmeSections.push(
        `## Environment variables\n\nCopy \`.env.example\` to \`.env\` and fill in the required values:\n\n\`\`\`bash\ncp .env.example .env\n\`\`\`\n\nRequired variables:\n\n${envVars.length ? envVars.map((v) => `- \`${v}\``).join("\n") : "See `.env.example` for the full list."}`,
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

  // ── Entry-point wiring ────────────────────────────────────────────────────

  // Sentry — wire import into app entry point
  if (fixIds.includes("monitoring")) {
    if (framework === "Next.js") {
      // Next.js 13.4+: instrumentation.ts registers on startup, no entry patching needed
      add("instrumentation.ts", SENTRY_INSTRUMENTATION_NEXTJS);
      note("monitoring", "verified", "instrumentation.ts created (Next.js App Router)");
    } else if (framework === "Python") {
      note("monitoring", "verified", "src/sentry.py created — import it at the top of your app entry file (e.g. manage.py or app.py)");
    } else if (framework === "Ruby") {
      note("monitoring", "verified", "config/initializers/sentry.rb created — Rails auto-loads initializers on boot");
    } else if (framework === "Go") {
      note("monitoring", "verified", "internal/sentry/sentry.go created — call sentry.Init() in your main() before starting the server");
    } else if (framework === "Java") {
      note("monitoring", "verified", "sentry.properties created — add io.sentry:sentry-spring-boot-starter-jakarta to your pom.xml or build.gradle");
    } else if (framework === "PHP") {
      note("monitoring", "verified", "config/sentry.php created — add sentry/sentry-laravel to composer.json and set SENTRY_LARAVEL_DSN in .env");
    } else if (framework === "Rust") {
      note("monitoring", "verified", "src/sentry.rs created — call sentry::init() at the top of main() and add sentry = \"0.34\" to Cargo.toml");
    } else {
      const entryPoint = await detectEntryPoint(token, fullName, framework);
      if (entryPoint) {
        const importPath = entryPoint.startsWith("src/") ? "./lib/sentry" : "./src/lib/sentry";
        const patched = await patchSourceFile(
          token,
          fullName,
          entryPoint,
          [`import "${importPath}";`],
          [],
        );
        if (patched) {
          add(entryPoint, patched);
          note("monitoring", "verified", `Sentry import wired into ${entryPoint}`);
        } else {
          note(
            "monitoring",
            "warning",
            `Found ${entryPoint} but could not patch — add \`import "${importPath}"\` manually`,
          );
        }
      } else {
        note(
          "monitoring",
          "warning",
          `No entry point found — add \`import "./lib/sentry"\` to your app entry file`,
        );
      }
    }
  }

  // Express middleware — wire imports + usage into detected entry point
  const expressMiddlewareFixes = ["helmet", "rate-limit", "logger"].filter((id) =>
    fixIds.includes(id),
  );
  if (expressMiddlewareFixes.length > 0) {
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

    const entryPoint = await detectEntryPoint(token, fullName, "Express");
    if (entryPoint) {
      const patched = await patchSourceFile(token, fullName, entryPoint, indexImports, indexUsages);
      if (patched) {
        add(entryPoint, patched);
        for (const id of expressMiddlewareFixes) {
          note(id, "verified", `middleware wired into ${entryPoint}`);
        }
      } else {
        for (const id of expressMiddlewareFixes) {
          note(
            id,
            "warning",
            `Found ${entryPoint} but could not patch — add middleware imports manually`,
          );
        }
      }
    } else {
      for (const id of expressMiddlewareFixes) {
        note(id, "warning", `Express entry point not found — add middleware imports manually`);
      }
    }
  }

  const files = [...fileMap.entries()].map(([path, content]) => ({ path, content }));
  return { files, verificationNotes };
}

// ─── PR creation from pre-generated files ────────────────────────────────────

export async function createPRFromFiles(
  token: string,
  repoFullName: string,
  defaultBranch: string,
  branchName: string,
  fixIds: string[],
  files: { path: string; content: string }[],
  verificationNotes?: VerificationNote[],
  framework?: string,
): Promise<{ prNumber: number; prUrl: string }> {
  if (!files.length) throw new Error("No files to commit.");

  const { assertGitHubRepoWriteAccess } = await import("./github.server");
  await assertGitHubRepoWriteAccess(token, repoFullName);

  const repoMeta = await ghGet<{ full_name: string; default_branch: string }>(
    token,
    `/repos/${repoFullName}`,
  );
  const fullName = repoMeta.full_name;
  const baseBranch = repoMeta.default_branch || defaultBranch;

  const refData = await ghGet<{ object: { sha: string } }>(
    token,
    `/repos/${fullName}/git/ref/heads/${baseBranch}`,
  );
  const baseSha = refData.object.sha;

  const commitData = await ghGet<{ tree: { sha: string } }>(
    token,
    `/repos/${fullName}/git/commits/${baseSha}`,
  );
  const baseTreeSha = commitData.tree.sha;

  const labels = fixIds.map((id) => FIX_LABEL[id] ?? id);
  const commitMessage = `chore: add production setup\n\nAdded: ${labels.join(", ")}\n\nGenerated by LaunchReadyy`;

  const normalizedFiles = files.map((f) => ({
    path: f.path.replace(/^\/+/, ""),
    content: f.content,
  }));

  try {
    const newTreeSha = await createTree(token, fullName, baseTreeSha, normalizedFiles);
    const newCommitSha = await createCommit(
      token,
      fullName,
      commitMessage,
      newTreeSha,
      baseSha,
    );
    await createOrUpdateBranch(token, fullName, branchName, newCommitSha);
  } catch (treesErr) {
    await ensureBranch(token, fullName, branchName, baseSha);
    try {
      await commitFilesViaContentsApi(
        token,
        fullName,
        branchName,
        normalizedFiles,
        commitMessage,
      );
    } catch (contentsErr) {
      const treesMsg = treesErr instanceof Error ? treesErr.message : String(treesErr);
      const contentsMsg = contentsErr instanceof Error ? contentsErr.message : String(contentsErr);
      throw new Error(`Git Trees API failed: ${treesMsg}\nContents API fallback failed: ${contentsMsg}`);
    }
  }

  const titleSuffix =
    fixIds.length > 3
      ? `${fixIds
          .slice(0, 3)
          .map((id) => FIX_LABEL[id] ?? id)
          .join(", ")} +${fixIds.length - 3} more`
      : labels.join(", ");

  const verificationSection =
    verificationNotes && verificationNotes.length > 0
      ? [
          `## Verification`,
          ``,
          `| Fix | Status | Notes |`,
          `|-----|--------|-------|`,
          ...verificationNotes.map(
            (n) =>
              `| ${FIX_LABEL[n.fixId] ?? n.fixId} | ${n.status === "verified" ? "✅" : "⚠️ needs manual step"} | ${n.note} |`,
          ),
          ``,
        ]
      : [];

  const whyLines = fixIds
    .filter((id) => FIX_WHY[id])
    .map((id) => `- **${FIX_LABEL[id] ?? id}:** ${FIX_WHY[id]}`);

  const setupSteps: string[] = [];
  if (fixIds.includes("monitoring")) {
    const dsnVar = framework === "Vite" || framework === "React" ? "VITE_SENTRY_DSN" : "SENTRY_DSN";
    setupSteps.push(
      `### ⚠️ Action required: activate Sentry`,
      ``,
      `1. Sign up for a free account at [sentry.io](https://sentry.io)`,
      `2. Create a new project and copy your DSN`,
      `3. Add it to your environment variables:`,
      `   \`\`\``,
      `   ${dsnVar}=https://your-dsn@sentry.io/your-project-id`,
      `   \`\`\``,
      `4. Deploy — Sentry will start capturing errors immediately`,
      ``,
    );
  }

  const prBody = [
    `## Production setup added by LaunchReadyy`,
    ``,
    ...whyLines,
    ``,
    ...setupSteps,
    ...verificationSection,
    `<details><summary>Files changed (${files.length})</summary>`,
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
    fullName,
    branchName,
    baseBranch,
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
  const { files, verificationNotes } = await collectFixFiles(token, repoFullName, fixIds, opts);
  return createPRFromFiles(
    token,
    repoFullName,
    defaultBranch,
    branchName,
    fixIds,
    files,
    verificationNotes,
    opts?.framework,
  );
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
  const { files } = await collectFixFiles(token, fullName, fixIds, opts);
  return computeDiffsFromFiles(token, fullName, files);
}
