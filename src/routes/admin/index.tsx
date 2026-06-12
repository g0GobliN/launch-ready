import { createFileRoute } from "@tanstack/react-router";
import { loadAdminOverviewFn } from "@/lib/api/admin.functions";
import { Users, CreditCard, TrendingUp, ScanLine, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Overview — Admin" }] }),
  loader: () => loadAdminOverviewFn({ data: { days: 30 } }),
  component: AdminOverview,
});

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--card-foreground)",
  fontSize: 13,
};
const TOOLTIP_ITEM_STYLE = { color: "var(--card-foreground)" };
const TOOLTIP_LABEL_STYLE = { color: "var(--muted-foreground)" };

const TICK = { fontSize: 12, fill: "#94a3b8" };
const GRID_COLOR = "rgba(148,163,184,0.15)";
const DAY_OPTIONS = [7, 14, 30] as const;

function useChartDays() {
  const [days, setDays] = useState<7 | 14 | 30>(30);
  return [days, setDays] as const;
}

function DayToggle({ value, onChange }: { value: number; onChange: (v: 7 | 14 | 30) => void }) {
  return (
    <div className="flex gap-1">
      {DAY_OPTIONS.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded px-2 py-0.5 text-xs font-medium transition cursor-pointer ${value === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/60"}`}
        >
          {o}D
        </button>
      ))}
    </div>
  );
}

function ChartHeader({
  title,
  days,
  onChange,
}: {
  title: string;
  days: number;
  onChange: (v: 7 | 14 | 30) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm font-semibold">{title}</p>
      <DayToggle value={days} onChange={onChange} />
    </div>
  );
}

function sliceDays<T>(data: T[], days: number): T[] {
  return data.slice(-days);
}

function sparseTick(data: { date: string }[], days: number) {
  const interval = days <= 7 ? 1 : days <= 14 ? 2 : 5;
  return data.map((d, i) => ({ ...d, displayDate: i % interval === 0 ? d.date : "" }));
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold mt-0.5">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function AdminOverview() {
  const { charts, stats } = Route.useLoaderData();
  const [signupDays, setSignupDays] = useChartDays();
  const [scanDays, setScanDays] = useChartDays();
  const [jobDays, setJobDays] = useChartDays();

  const signupData = sparseTick(sliceDays(charts.signupsByDay, signupDays), signupDays);
  const scanData = sparseTick(sliceDays(charts.scansByDay, scanDays), scanDays);
  const jobData = sparseTick(sliceDays(charts.jobsByDay, jobDays), jobDays);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Activity at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          sub={`${stats.conversionRate}% paid`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Paid Users"
          value={stats.paidUsers}
          sub={`${stats.totalUsers - stats.paidUsers} free`}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="MRR"
          value={`$${stats.mrr.toLocaleString()}`}
          sub="this month"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Scans"
          value={stats.scansThisMonth}
          sub={`${stats.jobsThisMonth} fix jobs`}
          icon={<ScanLine className="h-4 w-4" />}
        />
        <StatCard
          label="Job success"
          value={
            stats.completedJobs + stats.failedJobs > 0
              ? `${Math.round((stats.completedJobs / (stats.completedJobs + stats.failedJobs)) * 100)}%`
              : "—"
          }
          sub={`${stats.failedJobs} failed`}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <ChartHeader title="User Signups" days={signupDays} onChange={setSignupDays} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="displayDate" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="signups"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#gS)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Plan Distribution</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.planDist}
                  dataKey="count"
                  nameKey="plan"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {charts.planDist.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                <Legend
                  iconType="circle"
                  iconSize={9}
                  wrapperStyle={{ fontSize: 13, color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <ChartHeader title="Scans" days={scanDays} onChange={setScanDays} />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scanData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="displayDate" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                <Bar dataKey="scans" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <ChartHeader title="Fix Jobs" days={jobDays} onChange={setJobDays} />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={jobData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gJ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="displayDate" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="jobs"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gJ)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
