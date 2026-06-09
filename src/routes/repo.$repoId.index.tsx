import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { getRepoFn, getScanFn } from "@/lib/api/db.functions";
import { ScoreRing, SeverityBadge } from "@/components/ui-bits";
import { ArrowRight, BrainCircuit, Clock, Github } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/repo/$repoId/")({
  head: () => ({ meta: [{ title: "Analysis — LaunchReadyy" }] }),
  component: RepoPage,
  notFoundComponent: () => <div className="p-10 text-center">Repo not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async ({ params }) => {
    const [repo, scan] = await Promise.all([
      getRepoFn({ data: { repoId: params.repoId } }),
      getScanFn({ data: { repoId: params.repoId } }),
    ]);
    if (!repo) throw notFound();
    return { repo, scan };
  },
});

function RepoPage() {
  const { repo, scan } = Route.useLoaderData() as {
    repo: NonNullable<Awaited<ReturnType<typeof getRepoFn>>>;
    scan: Awaited<ReturnType<typeof getScanFn>>;
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    if (!scan) return {};
    const by: Record<string, typeof scan.issues> = {};
    scan.issues.forEach((i: (typeof scan.issues)[number]) => {
      (by[i.category] ||= []).push(i);
    });
    return by;
  }, [scan]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  if (!scan) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto flex max-w-lg flex-col items-center px-6 pt-32 text-center">
          <h1 className="font-display text-2xl font-semibold">No scan yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Go back to the dashboard and click <strong>Analyze</strong> on{" "}
            <span className="font-mono">{repo.full_name}</span>.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <span>/</span>
          <span className="font-mono text-foreground">{repo.full_name}</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col items-center">
              <ScoreRing score={scan.score} />
              <div className="mt-4 text-center">
                <div className="font-display text-base font-semibold">Production Readiness</div>
                <div className="mt-1 text-xs text-muted-foreground">Scanned {scan.createdAt}</div>
              </div>
            </div>
            <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <Row k="Framework" v={repo.framework} />
              <Row k="Language" v={repo.language} />
              <Row k="Visibility" v={repo.private ? "Private" : "Public"} />
              <Row k="Issues" v={`${scan.issues.length} found`} />
            </div>
            <div className="mt-6 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" /> {repo.full_name}
              </div>
            </div>
            <Link
              to="/repo/$repoId/arch"
              params={{ repoId: repo.id }}
              className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs hover:bg-muted transition"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BrainCircuit className="h-3.5 w-3.5 text-accent" /> Architecture analysis
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </div>

          <div>
            <div className="flex items-end justify-between">
              <div>
                <h1 className="font-display text-2xl font-semibold">Missing items</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select the fixes you want bundled into a single pull request.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">{selected.size} selected</div>
            </div>

            <div className="mt-6 space-y-6">
              {Object.entries(categories).map(([cat, items]) => (
                <div key={cat}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
                      {cat}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {items.length} item{items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-border rounded-xl border border-border bg-card">
                    {items.map((i: (typeof scan.issues)[number]) => {
                      const isSel = selected.has(i.fixId);
                      return (
                        <label
                          key={i.id}
                          className="flex cursor-pointer items-start gap-4 p-4 transition hover:bg-surface"
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggle(i.fixId)}
                            className="mt-1 h-4 w-4 accent-[color:var(--color-primary)]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{i.title}</span>
                              <SeverityBadge severity={i.severity} />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{i.why}</p>
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary">
                              <Clock className="h-3 w-3" /> ~{i.timeSaved} saved
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-4 mt-8 flex items-center justify-between rounded-xl border border-border bg-card/90 p-4 backdrop-blur">
              <div className="text-sm">
                <span className="font-medium">{selected.size}</span>
                <span className="text-muted-foreground"> fixes ready for PR</span>
              </div>
              <Link
                to="/repo/$repoId/fix"
                params={{ repoId: repo.id }}
                search={{ fixes: Array.from(selected).join(",") }}
                disabled={selected.size === 0}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
                  selected.size === 0
                    ? "pointer-events-none bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                Preview changes <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
