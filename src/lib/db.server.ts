import { formatDistanceToNow } from "date-fns";
import { getServiceRoleClient } from "./supabase.server";
import type { Repo, Scan, Issue, Severity, FixRequest, FixRequestStatus } from "./mock-data";
import type { Database } from "./database.types";
import type { ArchFinding } from "./arch-scanner.server";

const supabase = getServiceRoleClient();

type RepoRow = Database["public"]["Tables"]["repos"]["Row"];
type ScanRow = Database["public"]["Tables"]["scans"]["Row"];
type IssueRow = Database["public"]["Tables"]["issues"]["Row"];

function toRepo(r: RepoRow): Repo {
  return {
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    description: r.description ?? "",
    language: r.language,
    stars: r.stars,
    updated: formatDistanceToNow(new Date(r.updated_at), { addSuffix: true }),
    private: r.private,
    framework: r.framework as Repo["framework"],
  };
}

export async function getRepos(): Promise<Repo[]> {
  const { data, error } = await supabase
    .from("repos")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<RepoRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRepo);
}

export async function getRepo(id: string): Promise<Repo | null> {
  const { data, error } = await supabase
    .from("repos")
    .select("*")
    .eq("id", id)
    .single()
    .returns<RepoRow>();
  if (error || !data) return null;
  return toRepo(data as RepoRow);
}

export async function getScan(repoId: string): Promise<Scan | null> {
  const { data: scanData, error: scanError } = await supabase
    .from("scans")
    .select("*")
    .eq("repo_id", repoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
    .returns<ScanRow>();

  if (scanError || !scanData) return null;
  const scan = scanData as ScanRow;

  const { data: issueData, error: issueError } = await supabase
    .from("issues")
    .select("*")
    .eq("scan_id", scan.id)
    .returns<IssueRow[]>();

  if (issueError) throw new Error(issueError.message);

  const issues: Issue[] = (issueData ?? []).map((i: IssueRow) => ({
    id: i.id,
    category: i.category,
    title: i.title,
    severity: i.severity as Severity,
    why: i.why,
    timeSaved: i.time_saved,
    fixId: i.fix_id,
  }));

  let warnings: string[] = [];
  if (scan.warnings) {
    try {
      warnings = JSON.parse(scan.warnings) as string[];
    } catch {
      warnings = [];
    }
  }

  return {
    id: scan.id,
    repoId: scan.repo_id,
    score: scan.score,
    createdAt: formatDistanceToNow(new Date(scan.created_at), { addSuffix: true }),
    issues,
    warnings,
  };
}

type FixRequestRow = Database["public"]["Tables"]["fix_requests"]["Row"];

function toFixRequest(r: FixRequestRow): FixRequest {
  return {
    id: r.id,
    repoId: r.repo_id,
    scanId: r.scan_id,
    fixes: r.fixes ? r.fixes.split(",").filter(Boolean) : [],
    status: r.status as FixRequestStatus,
    branchName: r.branch_name,
    prNumber: r.pr_number,
    prUrl: r.pr_url,
    errorMessage: r.error_message,
    estFilesAdded: r.est_files_added,
    estFilesChanged: r.est_files_changed,
    estDeps: r.est_deps,
    creditsCost: r.credits_cost,
    createdAt: formatDistanceToNow(new Date(r.created_at), { addSuffix: true }),
  };
}

export async function getFixRequest(id: string): Promise<FixRequest | null> {
  const { data, error } = await supabase
    .from("fix_requests")
    .select("*")
    .eq("id", id)
    .single()
    .returns<FixRequestRow>();
  if (error || !data) return null;
  return toFixRequest(data as FixRequestRow);
}

export async function getRecentFixRequests(
  owner?: string,
): Promise<Array<FixRequest & { repoFullName: string }>> {
  let repoIds: string[] | undefined;

  if (owner) {
    const { data: repos } = await supabase.from("repos").select("id").eq("owner", owner);
    repoIds = ((repos ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (repoIds.length === 0) return [];
  }

  let query = supabase
    .from("fix_requests")
    .select("*, repos(full_name)")
    .order("created_at", { ascending: false })
    .limit(10);

  if (repoIds) {
    query = query.in("repo_id", repoIds);
  }

  const { data, error } =
    await query.returns<Array<FixRequestRow & { repos: { full_name: string } | null }>>();
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...toFixRequest(r),
    repoFullName: r.repos?.full_name ?? "unknown",
  }));
}

export async function getAllFixRequests(
  owner: string,
): Promise<Array<FixRequest & { repoFullName: string }>> {
  const { data: repos } = await supabase.from("repos").select("id").eq("owner", owner);
  const repoIds = ((repos ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (repoIds.length === 0) return [];

  const { data, error } = await supabase
    .from("fix_requests")
    .select("*, repos(full_name)")
    .in("repo_id", repoIds)
    .order("created_at", { ascending: false })
    .returns<Array<FixRequestRow & { repos: { full_name: string } | null }>>();
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...toFixRequest(r),
    repoFullName: r.repos?.full_name ?? "unknown",
  }));
}

export async function getRecentScans(
  owner?: string,
): Promise<Array<{ repo: string; score: number; when: string }>> {
  let repoIds: string[] | undefined;

  if (owner) {
    const { data: repos } = await supabase.from("repos").select("id").eq("owner", owner);
    repoIds = ((repos ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (repoIds.length === 0) return [];
  }

  let query = supabase
    .from("scans")
    .select("score, created_at, repos(full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (repoIds) {
    query = query.in("repo_id", repoIds);
  }

  const { data, error } =
    await query.returns<
      Array<{ score: number; created_at: string; repos: { full_name: string } | null }>
    >();

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const deduped: typeof data = [];
  for (const s of data ?? []) {
    const name = s.repos?.full_name ?? "unknown";
    if (!seen.has(name)) {
      seen.add(name);
      deduped.push(s);
    }
    if (deduped.length === 5) break;
  }

  return deduped.map((s) => ({
    repo: s.repos?.full_name ?? "unknown",
    score: s.score,
    when: formatDistanceToNow(new Date(s.created_at), { addSuffix: true }),
  }));
}

export interface ArchScanRecord {
  id: string;
  repoId: string;
  score: number;
  findings: ArchFinding[];
  scannedFiles: number;
  createdAt: string;
}

type ArchScanRow = Database["public"]["Tables"]["arch_scans"]["Row"];

export async function getArchScan(repoId: string): Promise<ArchScanRecord | null> {
  const { data, error } = await supabase
    .from("arch_scans")
    .select("*")
    .eq("repo_id", repoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
    .returns<ArchScanRow>();

  if (error || !data) return null;
  return {
    id: data.id,
    repoId: data.repo_id,
    score: data.score,
    findings: JSON.parse(data.findings) as ArchFinding[],
    scannedFiles: data.scanned_files,
    createdAt: formatDistanceToNow(new Date(data.created_at), { addSuffix: true }),
  };
}

export async function saveArchScan(
  repoId: string,
  score: number,
  findings: ArchFinding[],
  scannedFiles: number,
): Promise<ArchScanRecord> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("arch_scans").insert({
    id,
    repo_id: repoId,
    score,
    findings: JSON.stringify(findings),
    scanned_files: scannedFiles,
  });
  if (error) throw new Error(error.message);
  return { id, repoId, score, findings, scannedFiles, createdAt: "just now" };
}
