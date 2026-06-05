import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { FIX_DETAILS, MOCK_REPOS, MOCK_SCANS, type FileDiff } from "@/lib/mock-data";
import { DiffView } from "@/components/diff-view";
import { ArrowLeft, FileEdit, FilePlus2, GitBranch, GitPullRequest, Package, ShieldCheck, Beaker } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/repo/$repoId/fix")({
  head: () => ({ meta: [{ title: "Preview changes — LaunchReady" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ fixes: (s.fixes as string) ?? "" }),
  component: FixPage,
  notFoundComponent: () => <div className="p-10 text-center">Not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-critical">{error.message}</div>,
  loader: ({ params }) => {
    const repo = MOCK_REPOS.find((r) => r.id === params.repoId);
    if (!repo) throw notFound();
    return { repo, scan: MOCK_SCANS[repo.id] };
  },
});

function FixPage() {
  const { repo } = Route.useLoaderData();
  const { fixes } = Route.useSearch();
  const navigate = Route.useNavigate();
  const initial = fixes ? fixes.split(",").filter(Boolean) : Object.keys(FIX_DETAILS).slice(0, 4);
  const [selected, setSelected] = useState<string[]>(initial);
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    const added = new Set<string>();
    const changed = new Set<string>();
    const deps = new Set<string>();
    const diffs: FileDiff[] = [];
    selected.forEach((id) => {
      const f = FIX_DETAILS[id];
      if (!f) return;
      f.files_added.forEach((x) => added.add(x));
      f.files_changed.forEach((x) => changed.add(x));
      f.deps.forEach((x) => deps.add(x));
      f.diffs.forEach((d) => diffs.push(d));
    });
    return { added: [...added], changed: [...changed], deps: [...deps], diffs };
  }, [selected]);

  const branchName = `launchready/production-ready-${new Date().toISOString().slice(0, 10)}`;

  const submit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1400));
    navigate({
      to: "/pr/$repoId",
      params: { repoId: repo.id },
      search: { fixes: selected.join(",") },
    });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link to="/repo/$repoId" params={{ repoId: repo.id }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to analysis
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold">Preview your pull request</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review what LaunchReady will add to <span className="font-mono">{repo.full_name}</span>.</p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="text-sm">
              <div className="font-medium text-foreground">We never commit directly to <span className="font-mono">main</span>.</div>
              <div className="mt-0.5 text-muted-foreground">LaunchReady creates a new branch and opens a Pull Request you can review before merging.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 sm:max-w-xs">
            <Beaker className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
            <div className="text-sm">
              <div className="font-medium">Demo mode</div>
              <div className="mt-0.5 text-xs text-muted-foreground">GitHub integration is mocked. No real PR will be created.</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-sm font-semibold">Fixes ({selected.length})</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(FIX_DETAILS).map(([id, f]) => {
                const isSel = selected.includes(id);
                return (
                  <label key={id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() =>
                        setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
                      }
                      className="h-4 w-4 accent-[color:var(--color-primary)]"
                    />
                    <span>{f.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-mono">{branchName}</span>
              </div>
            </div>

            <PreviewBlock icon={<FilePlus2 className="h-4 w-4 text-primary" />} title="Files added" items={preview.added} mono />
            <PreviewBlock icon={<FileEdit className="h-4 w-4 text-warning" />} title="Files changed" items={preview.changed} mono />
            <PreviewBlock icon={<Package className="h-4 w-4 text-accent" />} title="Dependencies to install" items={preview.deps} mono />

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">File diffs</h3>
                <span className="text-xs text-muted-foreground">{preview.diffs.length} file{preview.diffs.length === 1 ? "" : "s"}</span>
              </div>
              {preview.diffs.length === 0 ? (
                <div className="text-sm text-muted-foreground">Select a fix on the left to preview its diff.</div>
              ) : (
                <div className="space-y-3">
                  {preview.diffs.map((d, i) => (
                    <DiffView key={`${d.path}-${i}`} diff={d} />
                  ))}
                </div>
              )}
            </div>


            <div className="sticky bottom-4 flex items-center justify-between rounded-xl border border-primary/30 bg-card/90 p-4 backdrop-blur glow-primary">
              <div className="text-sm text-muted-foreground">
                {preview.added.length} added · {preview.changed.length} changed · {preview.deps.length} deps
              </div>
              <button
                onClick={submit}
                disabled={submitting || selected.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <GitPullRequest className="h-4 w-4" />
                {submitting ? "Creating pull request..." : "Create Pull Request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ icon, title, items, mono }: { icon: React.ReactNode; title: string; items: string[]; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Nothing in this category.</div>
      ) : (
        <ul className={`mt-3 grid gap-1.5 ${mono ? "font-mono text-xs" : "text-sm"} sm:grid-cols-2`}>
          {items.map((x) => (
            <li key={x} className="rounded-md border border-border bg-surface px-2.5 py-1.5">{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
