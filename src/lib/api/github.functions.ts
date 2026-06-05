import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getGitHubToken, clearAuthCookies } from "../github-token.server";
import { getServiceRoleClient } from "../supabase.server";
import { fetchGitHubRepos } from "../github.server";
import { scanRepository } from "../scanner.server";
import { deductCredits, refundCredits, checkScanLimit, incrementScanUsed, checkRepoLimit, checkPlanFeature } from "../credits.server";
import { AI_FIX_IDS, generateAiTests, hasAiTestCache } from "../ai-tests.server";
import { AI_FIX_COSTS, ARCH_SCAN_COST } from "../plans";

// Returns the GitHub OAuth URL — used by the Connect button in the browser.
// Returns display info for the currently-authenticated user, or null.
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const githubToken = getGitHubToken();
  const { getStoredUser } = await import("../github-token.server");
  const storedUser = getStoredUser();
  if (!githubToken || !storedUser) return null;
  return storedUser;
});

// Lists all GitHub repos for the authenticated user using the stored GitHub token.
export const listGitHubRepos = createServerFn({ method: "GET" }).handler(async () => {
  const githubToken = getGitHubToken();
  if (!githubToken) return [];
  return fetchGitHubRepos(githubToken);
});

const RepoInputSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  updated_at: z.string(),
  private: z.boolean(),
  owner_login: z.string(),
  default_branch: z.string(),
});

// Saves the user-selected GitHub repo to the database and returns its DB id.
export const saveSelectedRepo = createServerFn({ method: "POST" })
  .inputValidator(RepoInputSchema)
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    const user = getStoredUser();
    if (!user) throw new Error("Not authenticated");

    await checkRepoLimit(user.login);

    const db = getServiceRoleClient();
    const { error } = await db.from("repos").upsert({
      id: String(data.id),
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      language: data.language ?? "Unknown",
      stars: data.stargazers_count,
      updated_at: data.updated_at,
      private: data.private,
      framework: "unknown",
      owner: data.owner_login,
      default_branch: data.default_branch,
    });

    if (error) throw new Error(error.message);
    return { repoId: String(data.id) };
  });

// Scans a saved repo and writes scan + issues rows. Returns the new scan id.
export const triggerScan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ repoId: z.string() }))
  .handler(async ({ data }) => {
    const githubToken = getGitHubToken();
    if (!githubToken) throw new Error("GitHub token unavailable — please reconnect.");

    const { getStoredUser } = await import("../github-token.server");
    const user = getStoredUser();
    if (user) await checkScanLimit(user.login);

    const db = getServiceRoleClient();

    const { data: repo, error: repoErr } = await db
      .from("repos")
      .select("full_name, default_branch")
      .eq("id", data.repoId)
      .single();
    if (repoErr || !repo) throw new Error("Repo not found in database.");

    const result = await scanRepository(
      githubToken,
      repo.full_name,
      repo.default_branch ?? "main",
    );

    // Update detected framework on the repo row
    await db.from("repos").update({ framework: result.framework }).eq("id", data.repoId);

    // Insert scan row
    const scanId = crypto.randomUUID();
    const { error: scanErr } = await db.from("scans").insert({
      id: scanId,
      repo_id: data.repoId,
      score: result.score,
    });
    if (scanErr) throw new Error(scanErr.message);

    // Insert issue rows
    if (result.issues.length > 0) {
      const { error: issueErr } = await db.from("issues").insert(
        result.issues.map((issue, idx) => ({
          id: `${scanId}-${idx}`,
          scan_id: scanId,
          category: issue.category,
          title: issue.title,
          severity: issue.severity,
          why: issue.why,
          time_saved: issue.timeSaved,
          fix_id: issue.fixId,
        })),
      );
      if (issueErr) throw new Error(issueErr.message);
    }

    if (user) await incrementScanUsed(user.login).catch(() => {});

    return { scanId, score: result.score, issueCount: result.issues.length };
  });

// Signs the user out and clears the auth cookies.
export const logoutGitHub = createServerFn({ method: "POST" }).handler(async () => {
  clearAuthCookies();
});

// ─── Fix Request Job System ───────────────────────────────────────────────────

const CreateFixRequestSchema = z.object({
  repoId: z.string(),
  scanId: z.string(),
  fixes: z.string(),
  branchName: z.string(),
  estFilesAdded: z.number(),
  estFilesChanged: z.number(),
  estDeps: z.number(),
  creditsCost: z.number(),
});

// Creates a fix_request job with status=pending and returns its ID.
// For AI fixes: if a cached result already exists for this scan+fixes, overrides
// credits_cost to 0 so the user is not charged again on retry.
export const createFixRequest = createServerFn({ method: "POST" })
  .inputValidator(CreateFixRequestSchema)
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    const user = getStoredUser();
    if (!user) throw new Error("Not authenticated");

    const db = getServiceRoleClient();
    const jobId = crypto.randomUUID();

    // Compute server-side credit cost: template fixes = 0; AI fixes use per-fix cost from plans.ts.
    // If a cache hit exists for the AI portion, AI cost is 0 (retry uses same result).
    const selectedFixes = data.fixes.split(",").filter(Boolean);
    const aiFixIds = selectedFixes.filter((id) => AI_FIX_IDS.has(id));
    let aiCost = aiFixIds.reduce((sum, id) => sum + (AI_FIX_COSTS[id] ?? 0), 0);
    if (aiCost > 0 && (await hasAiTestCache(data.scanId, aiFixIds))) {
      aiCost = 0; // cache hit — retry is free
    }
    const creditsCost = aiCost;

    const { error } = await db.from("fix_requests").insert({
      id: jobId,
      repo_id: data.repoId,
      scan_id: data.scanId,
      fixes: data.fixes,
      status: "pending",
      branch_name: data.branchName,
      est_files_added: data.estFilesAdded,
      est_files_changed: data.estFilesChanged,
      est_deps: data.estDeps,
      credits_cost: creditsCost,
      owner_login: user.login,
    });

    if (error) throw new Error(error.message);
    return { jobId, creditsCost };
  });

// Background job: simulates PR creation. Runs fire-and-forget so the browser
// can be closed without cancelling the job — Node.js keeps the promise alive.
// ownerLogin + creditCost are passed so credits can be refunded on system error.
// githubToken + scanId are needed for AI test generation.
async function runFixJob(
  jobId: string,
  repoFullName: string,
  ownerLogin: string,
  creditCost: number,
  fixIds: string[],
  scanId: string,
  githubToken: string,
) {
  const db = getServiceRoleClient();
  try {
    // Run AI test generation for any AI-type fixes (uses cache when available)
    const aiFixIds = fixIds.filter((id) => AI_FIX_IDS.has(id));
    let aiFilesJson: string | null = null;
    if (aiFixIds.length > 0) {
      const aiFiles = await generateAiTests(scanId, aiFixIds, repoFullName, githubToken);
      aiFilesJson = JSON.stringify(aiFiles);
    }

    // Simulate the time a real PR creation would take
    await new Promise<void>((resolve) => setTimeout(resolve, 2000 + Math.random() * 1500));

    const prNumber = Math.floor(Math.random() * 900 + 100);
    const prUrl = `https://github.com/${repoFullName}/pull/${prNumber}`;
    await db.from("fix_requests").update({
      status: "completed",
      pr_number: prNumber,
      pr_url: prUrl,
      ...(aiFilesJson ? { ai_files: aiFilesJson } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (err) {
    // Refund credits on system error — do not refund on user cancel (handled separately)
    await refundCredits(ownerLogin, creditCost, jobId).catch(() => {});
    await db.from("fix_requests").update({
      status: "failed",
      error_message: err instanceof Error ? err.message : "Unknown error",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

// Transitions job from pending → running, deducts credits, then starts the background PR job.
export const confirmFixRequest = createServerFn({ method: "POST" })
  .inputValidator(z.object({ jobId: z.string() }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    const user = getStoredUser();
    if (!user) throw new Error("Not authenticated");

    const db = getServiceRoleClient();

    const githubToken = getGitHubToken();
    if (!githubToken) throw new Error("GitHub token unavailable — please reconnect.");

    type JobRow = { id: string; status: string; credits_cost: number; scan_id: string; fixes: string; repo_id: string; repos: { full_name: string } | null };
    const { data: jobRaw, error } = await db
      .from("fix_requests")
      .select("id, status, credits_cost, scan_id, fixes, repo_id, repos(full_name)")
      .eq("id", data.jobId)
      .single();
    const job = jobRaw as unknown as JobRow | null;

    if (error || !job) throw new Error("Job not found");
    if (job.status !== "pending") throw new Error("Job is not in pending state");

    // Deduct credits before the job starts (throws if insufficient balance)
    await deductCredits(user.login, job.credits_cost, data.jobId);

    await db.from("fix_requests").update({
      status: "running",
      owner_login: user.login,
      updated_at: new Date().toISOString(),
    }).eq("id", data.jobId);

    const repoFullName = job.repos?.full_name ?? "";
    const fixIds = job.fixes.split(",").filter(Boolean);
    // Fire and forget — does not block the response, survives browser close
    void runFixJob(data.jobId, repoFullName, user.login, job.credits_cost, fixIds, job.scan_id, githubToken);

    return { jobId: data.jobId };
  });

// Returns current job status — called by client-side polling.
export const getFixRequestFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ jobId: z.string() }))
  .handler(async ({ data }) => {
    const db = getServiceRoleClient();
    const { data: row, error } = await db
      .from("fix_requests")
      .select("*")
      .eq("id", data.jobId)
      .single();
    if (error || !row) return null;
    return row;
  });

export const loadDashboardFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDashboardData } = await import("../dashboard.server");
  return loadDashboardData();
});

// ─── Architecture analysis ────────────────────────────────────────────────────

// Returns existing arch scan for a repo, or null if none exists.
export const getArchScanFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ repoId: z.string() }))
  .handler(async ({ data }) => {
    const { getArchScan } = await import("../db.server");
    return getArchScan(data.repoId);
  });

// Runs a fresh architecture analysis and stores the result.
// Reuses a cached result if one was created within the last hour.
export const runArchScanFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ repoId: z.string() }))
  .handler(async ({ data }) => {
    const githubToken = getGitHubToken();
    if (!githubToken) throw new Error("GitHub token unavailable — please reconnect.");

    const { getStoredUser } = await import("../github-token.server");
    const user = getStoredUser();
    if (!user) throw new Error("Not authenticated");

    // Require pro+ plan for architecture analysis
    await checkPlanFeature(user.login, "pro");

    const db = getServiceRoleClient();
    const { data: repo, error: repoErr } = await db
      .from("repos")
      .select("full_name, default_branch")
      .eq("id", data.repoId)
      .single();
    if (repoErr || !repo) throw new Error("Repo not found.");

    // Check cache: if scanned in last hour, return existing result without charging credits
    const { getArchScan, saveArchScan } = await import("../db.server");
    const existing = await getArchScan(data.repoId);
    if (existing) {
      const ageMs = Date.now() - new Date(
        (await db.from("arch_scans").select("created_at").eq("id", existing.id).single()).data?.created_at ?? 0
      ).getTime();
      if (ageMs < 60 * 60 * 1000) return existing; // under 1 hour — free cache hit
    }

    // Deduct credits before running the scan
    await deductCredits(user.login, ARCH_SCAN_COST, crypto.randomUUID());

    const { runArchScan } = await import("../arch-scanner.server");
    const result = await runArchScan(githubToken, repo.full_name, repo.default_branch ?? "main");
    return saveArchScan(data.repoId, result.score, result.findings, result.scannedFiles);
  });

// Cancels a pending job.
export const cancelFixRequest = createServerFn({ method: "POST" })
  .inputValidator(z.object({ jobId: z.string() }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    if (!getStoredUser()) throw new Error("Not authenticated");

    const db = getServiceRoleClient();
    await db.from("fix_requests").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", data.jobId).eq("status", "pending");
  });
