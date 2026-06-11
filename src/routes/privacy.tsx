import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — LaunchReadyy" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12 prose prose-sm dark:prose-invert">
        <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: June 2026</p>

        <section className="mt-8 space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            LaunchReadyy helps you scan GitHub repositories and open pull requests with production
            foundation setup. This policy explains what we collect and how we use it.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>GitHub account login, avatar, and email (from OAuth)</li>
            <li>Repository metadata you connect (name, framework, scan scores, issues found)</li>
            <li>Billing data via Stripe (we do not store card numbers)</li>
            <li>Usage: scan counts, plan tier, fix job status</li>
          </ul>

          <h2 className="font-display text-lg font-semibold text-foreground">
            What we do not store
          </h2>
          <p>
            Your source code is analyzed in-memory via the GitHub API during scans and fix
            generation. We do not persist your repository file contents to our database.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">Email</h2>
          <p>
            We send transactional emails (welcome, billing, limits) via Resend. You can unsubscribe
            from marketing-style notifications in Settings or via the link in any email.
          </p>

          <h2 className="font-display text-lg font-semibold text-foreground">Contact</h2>
          <p>
            Questions:{" "}
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
