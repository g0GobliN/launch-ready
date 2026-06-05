import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { MOCK_REPOS, RECENT_SCANS } from "@/lib/mock-data";
import { Github, Lock, Star, Search, ArrowRight, Zap } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LaunchReady" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [q, setQ] = useState("");
  const repos = MOCK_REPOS.filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Repositories</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pick a repo to scan for production readiness.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
            <Github className="h-4 w-4 text-primary" />
            <span>Connected as <span className="font-medium">@you</span></span>
            <span className="text-muted-foreground">· 4 repos</span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search repositories..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {repos.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{r.full_name}</span>
                      {r.private && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">{r.framework}</span>
                    </div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{r.description}</div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/70" /> {r.language}</span>
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" /> {r.stars}</span>
                      <span>Updated {r.updated}</span>
                    </div>
                  </div>
                  <Link
                    to="/repo/$repoId"
                    params={{ repoId: r.id }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Zap className="h-3.5 w-3.5" /> Analyze
                  </Link>
                </div>
              ))}
              {repos.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No repos match your search.</div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-sm font-semibold">Recent scans</h3>
              <div className="mt-3 space-y-2">
                {RECENT_SCANS.map((s) => (
                  <div key={s.repo} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{s.repo}</div>
                      <div className="text-[10px] text-muted-foreground">{s.when}</div>
                    </div>
                    <div className={`font-display text-lg font-semibold ${s.score >= 60 ? "text-warning" : "text-critical"}`}>{s.score}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-card p-5 glow-primary">
              <h3 className="font-display text-sm font-semibold">Pro tip</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Run a scan after every major AI prompt to keep production debt low.
              </p>
              <a href="#" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Learn the workflow <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
