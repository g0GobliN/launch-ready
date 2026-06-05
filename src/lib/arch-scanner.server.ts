import { callAI } from "./ai-client.server";

const GITHUB_API = "https://api.github.com";
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"]);
const OVERSIZED_BYTES = 15_000; // ~300 lines
const MAX_FILES_TO_FETCH = 30;
const SCORE_WEIGHTS = {
  circularDep: 20,
  deadFile: 3,
  unusedPackage: 5,
  oversizedFile: 5,
  separationIssue: 10,
  duplicateLogic: 5,
};

export interface ArchFinding {
  id: string;
  type:
    | "circular-dep"
    | "dead-file"
    | "unused-package"
    | "oversized-file"
    | "separation-issue"
    | "duplicate-logic";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  files: string[];
  aiExplanation?: string;
}

export interface ArchScanResult {
  score: number;
  findings: ArchFinding[];
  scannedFiles: number;
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function ghFetch(token: string, path: string) {
  return fetch(`${GITHUB_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
  });
}

interface TreeNode { path: string; type: string; size?: number }

async function fetchTree(token: string, fullName: string, branch: string): Promise<TreeNode[]> {
  const res = await ghFetch(token, `/repos/${fullName}/git/trees/${branch}?recursive=1`);
  if (!res.ok) return [];
  const data = (await res.json()) as { tree: TreeNode[]; truncated?: boolean };
  return data.tree.filter((n) => n.type === "blob");
}

async function fetchFileContent(token: string, fullName: string, filePath: string): Promise<string | null> {
  const res = await ghFetch(token, `/repos/${fullName}/contents/${filePath}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return null;
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

// ─── Import parsing ───────────────────────────────────────────────────────────

function parseImports(content: string): string[] {
  const result: string[] = [];
  const importRe = /(?:import\s+(?:type\s+)?(?:[^'"{}]*from\s+)?|require\s*\()\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) result.push(m[1]);
  return result;
}

function ext(p: string): string {
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i);
}

function isSourceFile(p: string): boolean {
  return SOURCE_EXTS.has(ext(p)) && !p.endsWith(".d.ts") && !p.includes("node_modules");
}

function normalizePath(p: string): string {
  const parts = p.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== ".") out.push(part);
  }
  return out.join("/");
}

function resolveRelative(fromFile: string, imp: string, allPaths: string[]): string | null {
  const dir = fromFile.includes("/") ? fromFile.split("/").slice(0, -1).join("/") : "";
  const base = normalizePath(dir ? `${dir}/${imp}` : imp);
  const tries = [
    base,
    ...["ts", "tsx", "js", "jsx"].map((e) => `${base}.${e}`),
    ...["ts", "tsx", "js", "jsx"].map((e) => `${base}/index.${e}`),
  ];
  return tries.find((t) => allPaths.includes(t)) ?? null;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function buildGraph(
  files: Record<string, string>,
  allPaths: string[],
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const [filePath, content] of Object.entries(files)) {
    const edges = new Set<string>();
    for (const imp of parseImports(content)) {
      if (!imp.startsWith(".")) continue;
      const resolved = resolveRelative(filePath, imp, allPaths);
      if (resolved) edges.add(resolved);
    }
    graph.set(filePath, edges);
  }
  return graph;
}

function detectCycles(graph: Map<string, Set<string>>): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of graph.keys()) color.set(n, WHITE);
  const cycles: string[][] = [];

  function dfs(v: string, path: string[]) {
    color.set(v, GRAY);
    for (const u of graph.get(v) ?? []) {
      const s = color.get(u);
      if (s === GRAY) {
        const idx = path.indexOf(u);
        if (idx !== -1) cycles.push([...path.slice(idx), v, u]);
      } else if (s === WHITE) {
        dfs(u, [...path, v]);
      }
    }
    color.set(v, BLACK);
  }

  for (const n of graph.keys()) {
    if (color.get(n) === WHITE) dfs(n, []);
  }

  // Deduplicate by smallest path member
  const seen = new Set<string>();
  return cycles.filter((c) => {
    const key = [...c].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findDeadFiles(graph: Map<string, Set<string>>, entryPoints: Set<string>): string[] {
  const reachable = new Set<string>();
  function traverse(n: string) {
    if (reachable.has(n)) return;
    reachable.add(n);
    for (const c of graph.get(n) ?? []) traverse(c);
  }
  for (const e of entryPoints) traverse(e);
  return [...graph.keys()].filter((f) => !reachable.has(f));
}

function findUnusedPackages(pkgJson: string, allFiles: Record<string, string>): string[] {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try { pkg = JSON.parse(pkgJson); } catch { return []; }

  const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const allImports = Object.values(allFiles).flatMap(parseImports).filter((i) => !i.startsWith("."));
  const usedSet = new Set(
    allImports.map((i) => (i.startsWith("@") ? i.split("/").slice(0, 2).join("/") : i.split("/")[0])),
  );

  // Ignore packages that are unlikely to appear as explicit imports
  const IMPLICIT = new Set(["typescript", "prettier", "eslint", "@types/node"]);
  return declared.filter((d) => !usedSet.has(d) && !IMPLICIT.has(d) && !d.startsWith("@types/"));
}

function findOversizedFiles(tree: TreeNode[]): string[] {
  return tree.filter((n) => isSourceFile(n.path) && (n.size ?? 0) > OVERSIZED_BYTES).map((n) => n.path);
}

function checkSeparation(files: Record<string, string>): string[] {
  const issues: string[] = [];
  const DB_IMPORTS = /supabase|prisma|mongoose|sequelize|typeorm|drizzle/;

  for (const [path, content] of Object.entries(files)) {
    const isClientRoute = (path.includes("/routes/") || path.includes("/pages/")) &&
      !path.endsWith(".server.ts") && !path.endsWith(".server.tsx");
    const isComponent = path.includes("/components/") &&
      !path.endsWith(".server.ts") && !path.endsWith(".server.tsx");

    if ((isClientRoute || isComponent) && DB_IMPORTS.test(content)) {
      issues.push(path);
    }
  }
  return issues;
}

function findDuplicateLogic(files: Record<string, string>): string[][] {
  // Heuristic: two source files with identical external import sets (>=3 shared packages)
  const importSig = new Map<string, string[]>();
  for (const [path, content] of Object.entries(files)) {
    const pkgs = [...new Set(parseImports(content).filter((i) => !i.startsWith(".")))]
      .sort()
      .join(",");
    if (pkgs.split(",").length < 3) continue; // too few imports to compare
    (importSig.get(pkgs) ?? importSig.set(pkgs, []).get(pkgs)!).push(path);
  }
  return [...importSig.values()].filter((g) => g.length >= 2).map((g) => g.slice(0, 3));
}

// ─── AI explanations ──────────────────────────────────────────────────────────

async function addAiExplanations(findings: ArchFinding[]): Promise<void> {
  const complex = findings.filter((f) => f.type === "circular-dep" || f.type === "separation-issue");
  if (complex.length === 0) return;

  const items = complex
    .map((f, i) => `${i + 1}. [${f.type}] ${f.title}\nFiles: ${f.files.join(", ")}\nDetail: ${f.detail}`)
    .join("\n\n");

  const text = await callAI(
    `You are a senior software architect reviewing a codebase. Explain each finding below in 1-2 sentences: what the problem is and the simplest fix. Be concrete and actionable. Number your answers to match the input.\n\n${items}`,
    1024,
  );
  const answers = text.split(/\n(?=\d+\.)/).map((s) => s.replace(/^\d+\.\s*/, "").trim());
  complex.forEach((f, i) => {
    if (answers[i]) f.aiExplanation = answers[i];
  });
}

// ─── Score ────────────────────────────────────────────────────────────────────

function calcArchScore(findings: ArchFinding[]): number {
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.type] = (counts[f.type] ?? 0) + 1;

  let penalty = 0;
  penalty += Math.min(counts["circular-dep"] ?? 0, 2) * SCORE_WEIGHTS.circularDep;
  penalty += Math.min(counts["dead-file"] ?? 0, 5) * SCORE_WEIGHTS.deadFile;
  penalty += Math.min(counts["unused-package"] ?? 0, 4) * SCORE_WEIGHTS.unusedPackage;
  penalty += Math.min(counts["oversized-file"] ?? 0, 3) * SCORE_WEIGHTS.oversizedFile;
  penalty += Math.min(counts["separation-issue"] ?? 0, 2) * SCORE_WEIGHTS.separationIssue;
  penalty += Math.min(counts["duplicate-logic"] ?? 0, 2) * SCORE_WEIGHTS.duplicateLogic;
  return Math.max(0, 100 - penalty);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runArchScan(
  token: string,
  fullName: string,
  defaultBranch: string,
): Promise<ArchScanResult> {
  const tree = await fetchTree(token, fullName, defaultBranch);
  const sourcePaths = tree
    .filter((n) => isSourceFile(n.path) && !n.path.includes("node_modules") && !n.path.includes(".min."))
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0)) // fetch smaller files first
    .slice(0, MAX_FILES_TO_FETCH)
    .map((n) => n.path);
  const allSourcePaths = tree.filter((n) => isSourceFile(n.path)).map((n) => n.path);

  // Fetch file contents in parallel (batches of 6 to avoid rate limits)
  const files: Record<string, string> = {};
  const BATCH = 6;
  for (let i = 0; i < sourcePaths.length; i += BATCH) {
    const batch = sourcePaths.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((p) => fetchFileContent(token, fullName, p)));
    batch.forEach((p, j) => { if (results[j]) files[p] = results[j]!; });
  }

  const pkgContent = files["package.json"] ?? (await fetchFileContent(token, fullName, "package.json")) ?? "{}";

  const graph = buildGraph(files, allSourcePaths);

  // Detect entry points: files not imported by any other file + known entry names
  const ENTRY_NAMES = new Set(["src/main.ts", "src/main.tsx", "src/index.ts", "src/index.tsx",
    "index.ts", "index.js", "server.ts", "server.js", "app.ts", "app.js"]);
  const imported = new Set([...graph.values()].flatMap((s) => [...s]));
  const entryPoints = new Set([
    ...Object.keys(files).filter((f) => !imported.has(f) || ENTRY_NAMES.has(f)),
    ...[...ENTRY_NAMES].filter((e) => Object.keys(files).includes(e)),
  ]);

  const findings: ArchFinding[] = [];
  let idCounter = 0;
  const id = () => `arch-${++idCounter}`;

  // 1. Circular dependencies
  const cycles = detectCycles(graph);
  for (const cycle of cycles.slice(0, 5)) {
    findings.push({
      id: id(),
      type: "circular-dep",
      severity: "critical",
      title: `Circular dependency (${cycle.length} files)`,
      detail: `${cycle[0]} → … → ${cycle[cycle.length - 1]}`,
      files: cycle,
    });
  }

  // 2. Dead files (only show if we have enough coverage — >10 files fetched)
  if (Object.keys(files).length >= 10) {
    const dead = findDeadFiles(graph, entryPoints).filter((f) => !ENTRY_NAMES.has(f)).slice(0, 8);
    for (const f of dead) {
      findings.push({
        id: id(),
        type: "dead-file",
        severity: "low",
        title: "Unreachable file",
        detail: "No other file imports this module. It may be unused or an orphaned refactor.",
        files: [f],
      });
    }
  }

  // 3. Unused packages
  const unusedPkgs = findUnusedPackages(pkgContent, files).slice(0, 6);
  for (const pkg of unusedPkgs) {
    findings.push({
      id: id(),
      type: "unused-package",
      severity: "low",
      title: `Unused dependency: ${pkg}`,
      detail: "Package is declared in package.json but no import was found in the source files analyzed.",
      files: ["package.json"],
    });
  }

  // 4. Oversized files
  const oversized = findOversizedFiles(tree).slice(0, 5);
  for (const f of oversized) {
    const node = tree.find((n) => n.path === f);
    const kb = node?.size ? `${(node.size / 1000).toFixed(1)} KB` : "";
    findings.push({
      id: id(),
      type: "oversized-file",
      severity: "medium",
      title: `Oversized file${kb ? ` (${kb})` : ""}`,
      detail: "Files over ~300 lines are hard to navigate and often violate single-responsibility. Consider splitting.",
      files: [f],
    });
  }

  // 5. Separation of concerns
  const sepIssues = checkSeparation(files).slice(0, 4);
  for (const f of sepIssues) {
    findings.push({
      id: id(),
      type: "separation-issue",
      severity: "high",
      title: "Database access in client layer",
      detail: "A route or component imports a DB client directly. Move DB access to a server-only service layer.",
      files: [f],
    });
  }

  // 6. Duplicate logic
  const duplicates = findDuplicateLogic(files).slice(0, 3);
  for (const group of duplicates) {
    findings.push({
      id: id(),
      type: "duplicate-logic",
      severity: "medium",
      title: "Possible duplicated logic",
      detail: "These files share the same external import fingerprint. Review for copy-pasted logic that should be extracted.",
      files: group,
    });
  }

  // Add AI explanations for complex findings (circular deps + separation issues)
  await addAiExplanations(findings).catch(() => {}); // never block the scan on AI failure

  const score = calcArchScore(findings);
  return { score, findings, scannedFiles: Object.keys(files).length };
}
