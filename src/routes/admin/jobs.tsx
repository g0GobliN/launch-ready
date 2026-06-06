import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { loadAdminJobsFn } from "@/lib/api/admin.functions";
import { CheckCircle2, Clock, XCircle, Loader2, AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({ meta: [{ title: "Fix Jobs — Admin" }] }),
  validateSearch: z.object({ page: z.number().default(1), status: z.string().default("all"), search: z.string().default("") }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadAdminJobsFn({ data: deps }),
  component: AdminJobs,
});

const STATUS_FILTERS = ["all", "pending", "running", "completed", "failed", "cancelled"];

const STATUS_BADGE: Record<string, { icon: React.ReactNode; cls: string }> = {
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "text-emerald-400 bg-emerald-500/10" },
  running:   { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, cls: "text-blue-400 bg-blue-500/10" },
  pending:   { icon: <Clock className="h-3.5 w-3.5" />, cls: "text-muted-foreground bg-muted" },
  failed:    { icon: <XCircle className="h-3.5 w-3.5" />, cls: "text-destructive bg-destructive/10" },
  cancelled: { icon: <XCircle className="h-3.5 w-3.5" />, cls: "text-muted-foreground bg-muted" },
};

function AdminJobs() {
  const { jobs, total, page, pageSize } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/jobs" });
  const [inputSearch, setInputSearch] = useState(search.search ?? "");

  const totalPages = Math.ceil(total / pageSize);

  function setPage(p: number) { navigate({ search: (prev) => ({ ...prev, page: p }) }); }
  function setStatus(status: string) { navigate({ search: (prev) => ({ ...prev, status, page: 1 }) }); }
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search: (prev) => ({ ...prev, search: inputSearch, page: 1 }) });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">Fix Jobs</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{total.toLocaleString()} total jobs</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} placeholder="Search by user…" className="h-8 pl-8 text-sm w-48" />
        </form>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition cursor-pointer ${(search.status ?? "all") === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">Page {page} of {totalPages || 1}</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground bg-muted/30">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Repo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job: any) => {
                const badge = STATUS_BADGE[job.status] ?? { icon: <AlertCircle className="h-3.5 w-3.5" />, cls: "text-muted-foreground bg-muted" };
                return (
                  <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5 font-medium">
                        <img src={`https://avatars.githubusercontent.com/${job.owner_login}?s=28`} className="h-6 w-6 rounded-full border border-border" alt="" />
                        @{job.owner_login ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{job.repos?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badge.cls}`}>
                        {badge.icon}{job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{job.credits_cost} cr</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">No jobs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-xs text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`min-w-[28px] rounded-md border px-2 py-1 text-xs transition cursor-pointer ${p === page ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted text-muted-foreground"}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
