import { Link, useRouterState } from "@tanstack/react-router";
import { Rocket } from "lucide-react";

export function SiteHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isApp = path.startsWith("/dashboard") || path.startsWith("/repo") || path.startsWith("/pr");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-base font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Rocket className="h-4 w-4" />
          </span>
          LaunchReady
        </Link>
        {!isApp ? (
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
        ) : (
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Dashboard</Link>
            <Link to="/pricing" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Pricing</Link>
          </nav>
        )}
        <div className="flex items-center gap-2">
          {!isApp ? (
            <Link to="/dashboard" className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
              Connect GitHub
            </Link>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">@you</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
