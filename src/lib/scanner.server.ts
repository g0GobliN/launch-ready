import {
  type IssueInput,
  type NonJsManifests,
  README_PATHS,
  calcScore,
  checkCI,
  checkDockerfile,
  checkEnvExample,
  checkExpress,
  checkLintScript,
  checkMonitoring,
  checkNextJs,
  checkReadme,
  checkTestScript,
  checkVite,
  dedupeIssues,
  detectFramework,
  detectLanguage,
  isSupportedFramework,
} from "./scanner-rules";

export type { IssueInput };
export { SEVERITY_WEIGHT, calcScore, hasReadmeSetupSection } from "./scanner-rules";

const GITHUB_API = "https://api.github.com";

export interface ScanResult {
  score: number;
  framework: string;
  issues: IssueInput[];
  warnings: string[];
}

async function ghFetch(token: string, path: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "LaunchReadyy/1.0",
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

async function fetchReadme(token: string, fullName: string): Promise<string | null> {
  for (const path of README_PATHS) {
    const content = await fetchFileContent(token, fullName, path);
    if (content) return content;
  }
  return null;
}

async function fetchFileTree(
  token: string,
  fullName: string,
  defaultBranch: string,
): Promise<{ paths: string[]; truncated: boolean }> {
  const res = await ghFetch(token, `/repos/${fullName}/git/trees/${defaultBranch}?recursive=1`);
  if (!res.ok) return { paths: [], truncated: false };
  const data = (await res.json()) as {
    tree: Array<{ path: string; type: string }>;
    truncated?: boolean;
  };
  return {
    paths: data.tree.filter((n) => n.type === "blob").map((n) => n.path),
    truncated: data.truncated === true,
  };
}

export async function scanRepository(
  token: string,
  fullName: string,
  defaultBranch: string,
): Promise<ScanResult> {
  const [pkgRaw, readmeRaw, envExampleRaw, tree] = await Promise.all([
    fetchFileContent(token, fullName, "package.json"),
    fetchReadme(token, fullName),
    fetchFileContent(token, fullName, ".env.example").catch(() => null),
    fetchFileTree(token, fullName, defaultBranch),
  ]);

  const pkg = pkgRaw ? (JSON.parse(pkgRaw) as Record<string, unknown>) : {};
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
  const files = tree.paths;
  const jsFramework = detectFramework(pkg);
  const framework = jsFramework !== "unknown" ? jsFramework : detectLanguage(files);
  const warnings: string[] = [];

  // Fetch non-JS manifests in parallel for Sentry detection
  const isNonJs = !pkgRaw && framework !== "unknown";
  const [requirements, gemfile, goMod, composerJson, cargoToml, pomXml] = isNonJs
    ? await Promise.all([
        fetchFileContent(token, fullName, "requirements.txt").catch(() => null),
        fetchFileContent(token, fullName, "Gemfile").catch(() => null),
        fetchFileContent(token, fullName, "go.mod").catch(() => null),
        fetchFileContent(token, fullName, "composer.json").catch(() => null),
        fetchFileContent(token, fullName, "Cargo.toml").catch(() => null),
        fetchFileContent(token, fullName, "pom.xml").catch(() => null),
      ])
    : [null, null, null, null, null, null];
  const nonJsManifests: NonJsManifests = { requirements, gemfile, goMod, composerJson, cargoToml, pomXml };

  if (tree.truncated) {
    warnings.push(
      "Repository file tree was truncated by GitHub — some missing items may not have been detected.",
    );
  }

  if (!pkgRaw) {
    warnings.push("No package.json found — only basic checks were run.");
  }

  if (!isSupportedFramework(framework)) {
    warnings.push(
      "Limited scan: full framework checks run for Next.js, Vite, React, and Express. Other stacks get shared checks only.",
    );
  }

  const issues: IssueInput[] = [];
  const useAiFixes = Boolean(pkgRaw) && isSupportedFramework(jsFramework);

  checkCI(files, issues, useAiFixes ? "ci-ai" : "github-actions");
  checkEnvExample(envExampleRaw !== null, issues, useAiFixes ? "env-example-ai" : "env-example");
  checkReadme(readmeRaw, issues, useAiFixes ? "readme-ai" : "readme");
  if (pkgRaw) {
    checkTestScript(scripts, issues);
    checkLintScript(scripts, issues);
    checkDockerfile(files, issues);
  }

  if (framework === "Next.js") {
    checkNextJs(deps, files, issues);
    checkMonitoring(deps, files, issues);
  } else if (framework === "Vite" || framework === "React") {
    checkVite(deps, files, issues);
    checkMonitoring(deps, files, issues);
  } else if (framework === "Express") {
    checkExpress(deps, issues);
    checkMonitoring(deps, files, issues);
  } else if (pkgRaw) {
    checkMonitoring(deps, files, issues);
  } else if (framework !== "unknown") {
    // Non-JS language detected — run monitoring check with manifest content
    checkMonitoring({}, files, issues, nonJsManifests);
  }

  const unique = dedupeIssues(issues);

  return { score: calcScore(unique), framework, issues: unique, warnings };
}
