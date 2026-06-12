import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSessionUserFn, getUserPlanFn } from "@/lib/api/credits.functions";
import { Settings, LayoutDashboard, ArrowLeft } from "lucide-react";

interface SiteHeaderProps {
  user?: { login: string; avatarUrl: string; isAdmin?: boolean } | null;
}

export function SiteHeader({ user: userProp }: SiteHeaderProps) {
  const { data: sessionUser } = useQuery({
    queryKey: ["session-user"],
    queryFn: () => getSessionUserFn(),
    staleTime: Infinity,
  });
  const user = userProp
    ? { ...userProp, isAdmin: userProp.isAdmin ?? sessionUser?.isAdmin }
    : sessionUser;
  const { data: planData } = useQuery({
    queryKey: ["user-plan"],
    queryFn: () => getUserPlanFn(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
  const isAgency = planData?.plan === "agency";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = path.startsWith("/admin");
  const isApp =
    isAdmin ||
    path.startsWith("/dashboard") ||
    path.startsWith("/repo") ||
    path.startsWith("/pr") ||
    path.startsWith("/settings") ||
    path.startsWith("/team") ||
    path.startsWith("/jobs");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-base font-semibold shrink-0"
        >
          <div className="h-9 w-9 overflow-hidden">
            <img
              src="/logo/logoo.png"
              alt=""
              className="w-full h-full"
              style={{ transform: "scale(0.8)", transformOrigin: "center" }}
            />
          </div>
          LaunchReadyy
        </Link>

        {isAdmin ? (
          <nav />
        ) : !isApp ? (
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <Link
              to="/workflow"
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              How it works
            </Link>
            <a href="/#features" className="hover:text-foreground">
              Features
            </a>
            <Link
              to="/pricing"
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Pricing
            </Link>
            <a href="/#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
        ) : (
          <nav className="hidden sm:flex items-center gap-5 text-sm text-muted-foreground">
            <Link
              to="/dashboard"
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Dashboard
            </Link>
            {isAgency && (
              <Link
                to="/team"
                className="hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Team
              </Link>
            )}
            <Link
              to="/pricing"
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Pricing
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <ArrowLeft className="h-3 w-3" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              {user && (
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.login} className="h-5 w-5 rounded-full" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                      {user.login[0].toUpperCase()}
                    </span>
                  )}
                  <span className="hidden sm:inline text-muted-foreground">@{user.login}</span>
                </div>
              )}
            </div>
          ) : !isApp ? (
            <Link
              to="/dashboard"
              className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Connect GitHub
            </Link>
          ) : user ? (
            <div className="flex items-center gap-2">
              {user.isAdmin && (
                <Link
                  to="/admin"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface hover:bg-muted transition"
                  title="Admin"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              )}
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:bg-muted transition"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.login} className="h-5 w-5 rounded-full" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                    {user.login[0].toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline text-muted-foreground">@{user.login}</span>
              </Link>
              <Link
                to="/settings"
                className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface hover:bg-muted transition"
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Loading…</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
