export type Severity = "critical" | "high" | "medium" | "low";

export interface Issue {
  id: string;
  category: string;
  title: string;
  severity: Severity;
  why: string;
  timeSaved: string; // e.g. "2h"
  fixId: string;
}

export interface Repo {
  id: string;
  name: string;
  full_name: string;
  description: string;
  language: string;
  stars: number;
  updated: string;
  private: boolean;
  framework: "Next.js" | "React Vite" | "Express";
}

export interface Scan {
  id: string;
  repoId: string;
  score: number;
  createdAt: string;
  issues: Issue[];
}

export const MOCK_REPOS: Repo[] = [
  { id: "r1", name: "nextjs-saas-app", full_name: "demo/nextjs-saas-app", description: "Next.js SaaS App — auth, billing, dashboard", language: "TypeScript", stars: 42, updated: "2 hours ago", private: false, framework: "Next.js" },
  { id: "r2", name: "react-vite-dashboard", full_name: "demo/react-vite-dashboard", description: "React Vite Dashboard — analytics & charts", language: "TypeScript", stars: 18, updated: "yesterday", private: true, framework: "React Vite" },
  { id: "r3", name: "express-api-server", full_name: "demo/express-api-server", description: "Express API Server — REST endpoints + Postgres", language: "JavaScript", stars: 7, updated: "3 days ago", private: true, framework: "Express" },
];

const COMMON_ISSUES = (framework: Repo["framework"]): Issue[] => [
  { id: "i-vitest", fixId: "vitest", category: "Testing", title: "No unit test framework configured", severity: "high", why: "Without tests, regressions slip into production. Vitest gives instant feedback.", timeSaved: "3h" },
  { id: "i-playwright", fixId: "playwright", category: "Testing", title: "Missing end-to-end tests", severity: "medium", why: "E2E tests catch broken user flows before users do.", timeSaved: "4h" },
  { id: "i-ci", fixId: "github-actions", category: "CI/CD", title: "No GitHub Actions workflow", severity: "critical", why: "Every push should run lint, typecheck, and tests automatically.", timeSaved: "2h" },
  { id: "i-eslint", fixId: "eslint", category: "Code Quality", title: "ESLint not configured", severity: "high", why: "Catches bugs and enforces consistent style across contributors.", timeSaved: "1h" },
  { id: "i-prettier", fixId: "prettier", category: "Code Quality", title: "Prettier not configured", severity: "low", why: "Removes formatting debates and makes diffs clean.", timeSaved: "30m" },
  { id: "i-env", fixId: "env-example", category: "Security", title: "Missing .env.example", severity: "high", why: "Contributors can't run your app without knowing required env vars.", timeSaved: "1h" },
  { id: "i-docker", fixId: "dockerfile", category: "Deployment", title: framework === "Express" ? "No Dockerfile for backend" : "No Dockerfile", severity: "medium", why: "Reproducible builds for any deployment target.", timeSaved: "2h" },
  { id: "i-readme", fixId: "readme", category: "Documentation", title: "README missing setup section", severity: "medium", why: "Onboarding new devs (or your future self) takes hours without it.", timeSaved: "1h" },
  { id: "i-monitor", fixId: "monitoring", category: "Monitoring", title: "No error monitoring (Sentry)", severity: "high", why: "You won't know production crashes happened until users complain.", timeSaved: "2h" },
];

export const MOCK_SCANS: Record<string, Scan> = Object.fromEntries(
  MOCK_REPOS.map((r) => {
    const issues = COMMON_ISSUES(r.framework);
    // score: 100 minus weighted issues
    const weights: Record<Severity, number> = { critical: 12, high: 7, medium: 4, low: 2 };
    const score = Math.max(20, 100 - issues.reduce((s, i) => s + weights[i.severity], 0));
    return [r.id, { id: `s-${r.id}`, repoId: r.id, score, createdAt: "just now", issues }];
  })
);

export const RECENT_SCANS = [
  { repo: "demo/nextjs-saas-app", score: 62, when: "2h ago" },
  { repo: "demo/react-vite-dashboard", score: 48, when: "yesterday" },
  { repo: "demo/express-api-server", score: 55, when: "3 days ago" },
];

export type DiffLine = { type: "add" | "del" | "ctx" | "hunk"; text: string; oldNo?: number; newNo?: number };
export type FileDiff = { path: string; status: "added" | "modified"; lines: DiffLine[] };

export interface FixPreview {
  files_added: string[];
  files_changed: string[];
  deps: string[];
  diffs: FileDiff[];
}

const add = (text: string, newNo: number): DiffLine => ({ type: "add", text, newNo });
const ctx = (text: string, oldNo: number, newNo: number): DiffLine => ({ type: "ctx", text, oldNo, newNo });
const hunk = (text: string): DiffLine => ({ type: "hunk", text });

export const FIX_DETAILS: Record<string, FixPreview & { label: string }> = {
  vitest: {
    label: "Add Vitest",
    files_added: ["vitest.config.ts", "src/__tests__/example.test.ts"],
    files_changed: ["package.json"],
    deps: ["vitest", "@vitest/ui", "@testing-library/react"],
    diffs: [
      {
        path: "vitest.config.ts",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,10 @@"),
          add(`import { defineConfig } from "vitest/config";`, 1),
          add(`import react from "@vitejs/plugin-react";`, 2),
          add(``, 3),
          add(`export default defineConfig({`, 4),
          add(`  plugins: [react()],`, 5),
          add(`  test: {`, 6),
          add(`    environment: "jsdom",`, 7),
          add(`    globals: true,`, 8),
          add(`  },`, 9),
          add(`});`, 10),
        ],
      },
      {
        path: "package.json",
        status: "modified",
        lines: [
          hunk("@@ -8,4 +8,7 @@"),
          ctx(`  "scripts": {`, 8, 8),
          ctx(`    "dev": "vite",`, 9, 9),
          ctx(`    "build": "vite build",`, 10, 10),
          add(`    "test": "vitest",`, 11),
          add(`    "test:ui": "vitest --ui",`, 12),
          add(`    "test:coverage": "vitest run --coverage",`, 13),
          ctx(`  },`, 11, 14),
        ],
      },
    ],
  },
  playwright: {
    label: "Add Playwright",
    files_added: ["playwright.config.ts", "e2e/home.spec.ts"],
    files_changed: ["package.json", ".gitignore"],
    deps: ["@playwright/test"],
    diffs: [
      {
        path: "e2e/home.spec.ts",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,6 @@"),
          add(`import { test, expect } from "@playwright/test";`, 1),
          add(``, 2),
          add(`test("home loads", async ({ page }) => {`, 3),
          add(`  await page.goto("/");`, 4),
          add(`  await expect(page).toHaveTitle(/./);`, 5),
          add(`});`, 6),
        ],
      },
      {
        path: ".gitignore",
        status: "modified",
        lines: [
          hunk("@@ -10,2 +10,5 @@"),
          ctx(`node_modules`, 10, 10),
          ctx(`dist`, 11, 11),
          add(`/test-results/`, 12),
          add(`/playwright-report/`, 13),
          add(`/playwright/.cache/`, 14),
        ],
      },
    ],
  },
  "github-actions": {
    label: "Add GitHub Actions CI",
    files_added: [".github/workflows/ci.yml"],
    files_changed: [],
    deps: [],
    diffs: [
      {
        path: ".github/workflows/ci.yml",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,15 @@"),
          add(`name: CI`, 1),
          add(`on:`, 2),
          add(`  push: { branches: [main] }`, 3),
          add(`  pull_request:`, 4),
          add(`jobs:`, 5),
          add(`  test:`, 6),
          add(`    runs-on: ubuntu-latest`, 7),
          add(`    steps:`, 8),
          add(`      - uses: actions/checkout@v4`, 9),
          add(`      - uses: actions/setup-node@v4`, 10),
          add(`        with: { node-version: 20, cache: npm }`, 11),
          add(`      - run: npm ci`, 12),
          add(`      - run: npm run lint`, 13),
          add(`      - run: npm run typecheck`, 14),
          add(`      - run: npm test`, 15),
        ],
      },
    ],
  },
  eslint: {
    label: "Add ESLint config",
    files_added: ["eslint.config.js"],
    files_changed: ["package.json"],
    deps: ["eslint", "@typescript-eslint/parser", "@typescript-eslint/eslint-plugin"],
    diffs: [
      {
        path: "eslint.config.js",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,8 @@"),
          add(`import tseslint from "@typescript-eslint/eslint-plugin";`, 1),
          add(`import parser from "@typescript-eslint/parser";`, 2),
          add(``, 3),
          add(`export default [{`, 4),
          add(`  files: ["**/*.{ts,tsx}"],`, 5),
          add(`  languageOptions: { parser },`, 6),
          add(`  plugins: { "@typescript-eslint": tseslint },`, 7),
          add(`}];`, 8),
        ],
      },
    ],
  },
  prettier: {
    label: "Add Prettier",
    files_added: [".prettierrc", ".prettierignore"],
    files_changed: ["package.json"],
    deps: ["prettier"],
    diffs: [
      {
        path: ".prettierrc",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,6 @@"),
          add(`{`, 1),
          add(`  "semi": true,`, 2),
          add(`  "singleQuote": false,`, 3),
          add(`  "trailingComma": "all",`, 4),
          add(`  "printWidth": 100`, 5),
          add(`}`, 6),
        ],
      },
    ],
  },
  dockerfile: {
    label: "Add Dockerfile",
    files_added: ["Dockerfile", ".dockerignore"],
    files_changed: [],
    deps: [],
    diffs: [
      {
        path: "Dockerfile",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,11 @@"),
          add(`FROM node:20-alpine AS build`, 1),
          add(`WORKDIR /app`, 2),
          add(`COPY package*.json ./`, 3),
          add(`RUN npm ci`, 4),
          add(`COPY . .`, 5),
          add(`RUN npm run build`, 6),
          add(``, 7),
          add(`FROM node:20-alpine`, 8),
          add(`WORKDIR /app`, 9),
          add(`COPY --from=build /app ./`, 10),
          add(`CMD ["npm", "start"]`, 11),
        ],
      },
    ],
  },
  "env-example": {
    label: "Add .env.example",
    files_added: [".env.example"],
    files_changed: ["README.md"],
    deps: [],
    diffs: [
      {
        path: ".env.example",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,5 @@"),
          add(`# Copy to .env and fill in`, 1),
          add(`DATABASE_URL=`, 2),
          add(`NEXTAUTH_SECRET=`, 3),
          add(`STRIPE_SECRET_KEY=`, 4),
          add(`SENTRY_DSN=`, 5),
        ],
      },
    ],
  },
  readme: {
    label: "Add README setup section",
    files_added: [],
    files_changed: ["README.md"],
    deps: [],
    diffs: [
      {
        path: "README.md",
        status: "modified",
        lines: [
          hunk("@@ -1,3 +1,10 @@"),
          ctx(`# Project`, 1, 1),
          ctx(``, 2, 2),
          add(`## Getting started`, 3),
          add(``, 4),
          add(`\`\`\`bash`, 5),
          add(`cp .env.example .env`, 6),
          add(`npm install`, 7),
          add(`npm run dev`, 8),
          add(`\`\`\``, 9),
          ctx(`Existing description...`, 3, 10),
        ],
      },
    ],
  },
  monitoring: {
    label: "Add error monitoring (Sentry)",
    files_added: ["src/lib/sentry.ts"],
    files_changed: ["src/main.tsx", "package.json"],
    deps: ["@sentry/react"],
    diffs: [
      {
        path: "src/lib/sentry.ts",
        status: "added",
        lines: [
          hunk("@@ -0,0 +1,6 @@"),
          add(`import * as Sentry from "@sentry/react";`, 1),
          add(``, 2),
          add(`Sentry.init({`, 3),
          add(`  dsn: import.meta.env.VITE_SENTRY_DSN,`, 4),
          add(`  tracesSampleRate: 0.1,`, 5),
          add(`});`, 6),
        ],
      },
      {
        path: "src/main.tsx",
        status: "modified",
        lines: [
          hunk("@@ -1,3 +1,4 @@"),
          ctx(`import React from "react";`, 1, 1),
          ctx(`import ReactDOM from "react-dom/client";`, 2, 2),
          add(`import "./lib/sentry";`, 3),
          ctx(`import App from "./App";`, 3, 4),
        ],
      },
    ],
  },
};
