import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { FIX_DETAILS } from "@/lib/mock-data";
import { getRepoFn } from "@/lib/api/db.functions";
import { CheckCircle2, ExternalLink, FileCode2, GitPullRequest, Sparkles } from "lucide-react";

export const Route = createFileRoute("/pr/$repoId")({
  head: () => ({ meta: [{ title: "Pull request created — LaunchReadyy" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ fixes: (s.fixes as string) ?? "" }),
  component: PRPage,
  notFoundComponent: () => <div className="p-10 text-center">Not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async ({ params }) => {
    const repo = await getRepoFn({ data: { repoId: params.repoId } });
    if (!repo) throw notFound();
    return { repo };
  },
});

function PRPage() {
  const { repo } = Route.useLoaderData();
  const { fixes } = Route.useSearch();
  const fixIds: string[] = fixes.split(",").filter(Boolean);
  const labels = fixIds.map((id: string) => FIX_DETAILS[id]?.label).filter(Boolean) as string[];
  const filesAdded = fixIds.flatMap((id: string) => FIX_DETAILS[id]?.files_added ?? []);
  const filesChanged = fixIds.flatMap((id: string) => FIX_DETAILS[id]?.files_changed ?? []);

  const prNumber = Math.floor(Math.random() * 900 + 100);
  const prTitle = `chore: production readiness — ${labels.length} upgrades`;
  const prUrl = `https://github.com/${repo.full_name}/pull/${prNumber}`;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-primary/40 bg-card p-8 text-center glow-primary">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold">Pull request created</h1>
          <p className="mt-2 text-muted-foreground">
            LaunchReadyy opened a PR on <span className="font-mono">{repo.full_name}</span>. Review
            and merge to ship the upgrades.
          </p>
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <GitPullRequest className="h-4 w-4" /> View PR #{prNumber}{" "}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">PR title</div>
            <div className="mt-1 font-mono text-sm">{prTitle}</div>
            <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">URL</div>
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate font-mono text-sm text-primary hover:underline"
            >
              {prUrl}
            </a>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Includes</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {labels.map((l) => (
                <li key={l} className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Files changed</h3>
          </div>
          <ul className="mt-3 grid gap-1.5 font-mono text-xs sm:grid-cols-2">
            {[
              ...filesAdded.map((f: string) => ({ f, k: "A" })),
              ...filesChanged.map((f: string) => ({ f, k: "M" })),
            ].map(({ f, k }) => (
              <li
                key={k + f}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5"
              >
                <span
                  className={`rounded px-1 text-[10px] ${k === "A" ? "bg-primary/20 text-primary" : "bg-warning/20 text-warning"}`}
                >
                  {k}
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-sm font-semibold">Next steps</h3>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>1. Review the PR diff on GitHub.</li>
            <li>2. Run the new CI workflow to confirm it passes.</li>
            <li>
              3. Merge to <span className="font-mono">main</span> — your repo is production-ready.
            </li>
          </ol>
          <div className="mt-5 flex gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted"
            >
              Back to dashboard
            </Link>
            <Link
              to="/repo/$repoId"
              params={{ repoId: repo.id }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted"
            >
              Re-scan repo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
