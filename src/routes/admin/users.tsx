import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { loadAdminUsersFn, grantAdminCreditsFn, toggleAdminFn } from "@/lib/api/admin.functions";
import { PLANS } from "@/lib/plans";
import { Plus, Loader2, AlertCircle, Zap, ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
  validateSearch: z.object({ page: z.number().default(1), search: z.string().default(""), plan: z.string().default("all") }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadAdminUsersFn({ data: deps }),
  component: AdminUsers,
});

const PLAN_COLORS: Record<string, string> = {
  free:    "bg-muted text-muted-foreground",
  starter: "bg-emerald-500/10 text-emerald-400",
  pro:     "bg-blue-500/10 text-blue-400",
  agency:  "bg-yellow-500/10 text-yellow-400",
};

function AdminUsers() {
  const { users, total, page, pageSize } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/users" });

  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState("10");
  const [granting, setGranting] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [adminConfirm, setAdminConfirm] = useState<{ githubLogin: string; makeAdmin: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputSearch, setInputSearch] = useState(search.search ?? "");

  const totalPages = Math.ceil(total / pageSize);

  function setPage(p: number) { navigate({ search: (prev) => ({ ...prev, page: p }) }); }
  function setFilter(plan: string) { navigate({ search: (prev) => ({ ...prev, plan, page: 1 }) }); }
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search: (prev) => ({ ...prev, search: inputSearch, page: 1 }) });
  }

  async function handleToggleAdmin() {
    if (!adminConfirm) return;
    setTogglingAdmin(adminConfirm.githubLogin);
    try {
      await toggleAdminFn({ data: adminConfirm });
      setAdminConfirm(null);
      window.location.reload();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed");
      setAdminConfirm(null);
    } finally {
      setTogglingAdmin(null);
    }
  }

  async function handleGrant() {
    if (!grantTarget) return;
    setGranting(true);
    try {
      await grantAdminCreditsFn({ data: { githubLogin: grantTarget, amount: parseInt(grantAmount, 10) } });
      setGrantTarget(null);
      window.location.reload();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">Users</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{total.toLocaleString()} total users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} placeholder="Search username…" className="h-8 pl-8 text-sm w-52" />
        </form>
        <div className="flex gap-1">
          {["all", "free", "starter", "pro", "agency"].map((p) => (
            <button key={p} onClick={() => setFilter(p)} className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${(search.plan ?? "all") === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {p === "all" ? "All" : PLANS[p as keyof typeof PLANS]?.name ?? p}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">Page {page} of {totalPages || 1}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground bg-muted/30">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Scans</th>
                <th className="px-4 py-3 font-medium">AI Credits</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const planDef = PLANS[u.plan as keyof typeof PLANS] ?? PLANS.free;
                const scanPct = Math.min(100, (u.monthly_scan_used / u.monthly_scan_limit) * 100);
                return (
                  <tr key={u.github_login} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <a href={`https://github.com/${u.github_login}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 font-medium hover:text-primary transition-colors">
                        <img src={`https://avatars.githubusercontent.com/${u.github_login}?s=32`} className="h-7 w-7 rounded-full border border-border" alt="" />
                        @{u.github_login}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_COLORS[u.plan] ?? PLAN_COLORS.free}`}>{planDef.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${scanPct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{u.monthly_scan_used}/{u.monthly_scan_limit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{u.balance}</span> / {u.ai_credits_total} cr</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setAdminConfirm({ githubLogin: u.github_login, makeAdmin: !u.is_admin })}
                        disabled={togglingAdmin === u.github_login}
                        title={u.is_admin ? "Revoke admin" : "Make admin"}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition cursor-pointer disabled:opacity-50 ${u.is_admin ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-border hover:bg-muted text-muted-foreground"}`}
                      >
                        {togglingAdmin === u.github_login ? <Loader2 className="h-3 w-3 animate-spin" /> : u.is_admin ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                        {u.is_admin ? "Admin" : "User"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setGrantTarget(u.github_login)} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted transition cursor-pointer">
                        <Plus className="h-3 w-3" /> Grant Credits
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      <Dialog open={!!grantTarget} onOpenChange={() => setGrantTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Grant AI Credits</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Adding credits to <strong className="text-foreground">@{grantTarget}</strong></p>
            <Input type="number" min={1} value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="Amount" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={granting}>{granting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adminConfirm} onOpenChange={() => setAdminConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{adminConfirm?.makeAdmin ? "Grant admin access" : "Revoke admin access"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {adminConfirm?.makeAdmin
              ? <>Give <strong className="text-foreground">@{adminConfirm.githubLogin}</strong> full admin access to this dashboard?</>
              : <>Remove admin access from <strong className="text-foreground">@{adminConfirm?.githubLogin}</strong>?</>}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminConfirm(null)}>Cancel</Button>
            <Button variant={adminConfirm?.makeAdmin ? "default" : "destructive"} onClick={handleToggleAdmin}>
              {adminConfirm?.makeAdmin ? "Grant" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorMsg} onOpenChange={() => setErrorMsg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Error</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <DialogFooter><Button variant="outline" onClick={() => setErrorMsg(null)}>Dismiss</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
