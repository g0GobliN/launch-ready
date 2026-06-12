import { createFileRoute, redirect, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { checkAdminFn } from "@/lib/api/admin.functions";
import { SiteHeader } from "@/components/site-header";
import { BarChart3, Users, Wrench, TrendingUp, Gift, ChevronRight, Calculator } from "lucide-react";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    try {
      await checkAdminFn();
      return {};
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/", label: "Overview", icon: <BarChart3 className="h-4 w-4" />, exact: true },
  { to: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" />, exact: false },
  { to: "/admin/jobs", label: "Fix Jobs", icon: <Wrench className="h-4 w-4" />, exact: false },
  {
    to: "/admin/revenue",
    label: "Revenue",
    icon: <TrendingUp className="h-4 w-4" />,
    exact: false,
  },
  {
    to: "/admin/economics",
    label: "Economics",
    icon: <Calculator className="h-4 w-4" />,
    exact: false,
  },
  {
    to: "/admin/promotions",
    label: "Promotions",
    icon: <Gift className="h-4 w-4" />,
    exact: false,
  },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function isActive(to: string, exact: boolean) {
    return exact
      ? pathname === to.replace(/\/$/, "") || pathname === "/admin"
      : pathname.startsWith(to);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Mobile nav — horizontal scrollable tab bar */}
      <div className="lg:hidden border-b border-border bg-card overflow-x-auto">
        <div className="flex px-4 py-2 gap-1 w-max min-w-full">
          {NAV.map(({ to, label, icon, exact }) => {
            const active = isActive(to, exact);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {icon}
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 lg:py-8 lg:flex lg:gap-6">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:block w-52 shrink-0 self-stretch">
          <div className="sticky top-8 rounded-xl border border-border bg-card p-2 space-y-0.5 min-h-[calc(100vh-8rem)]">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Admin
            </p>
            {NAV.map(({ to, label, icon, exact }) => {
              const active = isActive(to, exact);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {icon}
                    {label}
                  </span>
                  {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
