import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — LaunchReadyy" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <section className="mt-8 space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            By using LaunchReadyy you agree to these terms. The service scans repositories and opens
            pull requests with suggested production foundation files — it is not a security audit or
            guarantee of production readiness.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">Service scope</h2>
          <p>
            LaunchReadyy provides automated checklist-based scans and template fixes for JavaScript
            / TypeScript projects (Next.js, Vite, React, Express). You are responsible for reviewing
            every pull request before merging.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">GitHub access</h2>
          <p>
            You grant us permission to read connected repositories and create branches and pull
            requests on repos you select. We never push directly to your default branch.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">Billing</h2>
          <p>
            Paid plans renew monthly via Stripe until cancelled. Refunds are handled case-by-case —
            contact support.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">Limitation</h2>
          <p>
            The service is provided as-is. We are not liable for outages, incorrect scan results, or
            issues introduced by generated pull requests you choose to merge.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">Contact</h2>
          <p>
            <a href="mailto:launchreadyy@gmail.com" className="text-primary hover:underline">
              launchreadyy@gmail.com
            </a>
          </p>
        </section>

        <p className="mt-10 text-sm">
          <Link to="/" className="text-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
