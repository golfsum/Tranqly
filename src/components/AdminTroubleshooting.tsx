"use client";

import { useEffect, useMemo, useState } from "react";
import { firebaseConfigured, getFirebase } from "@/lib/firebase";
import { listAdminAiUsage, listAdminErrors, listAdminSiteAnalytics, listAdminSupportTickets, listAdminUsers, listAdminWaitlistSignups, WAITLIST_MAX_SPOTS } from "@/lib/adminSupport";

type AdminRow = Record<string, any> & { id: string };

function formatDate(value: any) {
  if (!value) return "Never";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
  return String(value);
}

function dateValue(value: any) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate() as Date;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function featureCalls(period: AdminRow | undefined, feature: string) {
  return Number(period?.features?.[feature]?.calls ?? 0);
}

function featureCost(period: AdminRow | undefined, feature: string) {
  return Number(period?.features?.[feature]?.cost ?? 0);
}

function featureLabel(feature: string) {
  const labels: Record<string, string> = {
    daily_insight: "Get Insights",
    weekly_summary: "Weekly Insights",
    reflection_classifier: "Reflection guardrail",
    prompt_selection: "Prompt personalization",
    tag_detection: "Tag detection",
    monthly_summary: "Monthly summary",
    long_term_pattern: "Long-term patterns",
  };
  return labels[feature] ?? feature.replaceAll("_", " ");
}

export default function AdminTroubleshooting() {
  const [users, setUsers] = useState<AdminRow[]>([]);
  const [tickets, setTickets] = useState<AdminRow[]>([]);
  const [errors, setErrors] = useState<AdminRow[]>([]);
  const [waitlist, setWaitlist] = useState<AdminRow[]>([]);
  const [siteAnalytics, setSiteAnalytics] = useState<AdminRow[]>([]);
  const [aiUsage, setAiUsage] = useState<{ periods: AdminRow[]; users: AdminRow[]; logs: AdminRow[] }>({
    periods: [],
    users: [],
    logs: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const adminUid = getFirebase()?.auth.currentUser?.uid ?? "";
  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "tranqly-e91fb";
  const adminDocumentUrl = adminUid
    ? `https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/-default-/data/~2Fadmins~2F${adminUid}`
    : `https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/-default-/data/~2Fadmins`;

  async function loadDashboard() {
    if (!firebaseConfigured()) return;
    setLoading(true);
    setLoadErrors([]);
    const loaders = [
      ["users", listAdminUsers],
      ["support tickets", listAdminSupportTickets],
      ["errors", listAdminErrors],
      ["AI usage", listAdminAiUsage],
      ["waitlist", listAdminWaitlistSignups],
      ["site analytics", listAdminSiteAnalytics],
    ] as const;
    const results = await Promise.allSettled(loaders.map(([, loader]) => loader()));
    const failures: string[] = [];

    results.forEach((result, index) => {
      const label = loaders[index][0];
      if (result.status === "rejected") {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failures.push(`${label}: ${reason}`);
        return;
      }
      if (index === 0) setUsers(result.value as AdminRow[]);
      if (index === 1) setTickets(result.value as AdminRow[]);
      if (index === 2) setErrors(result.value as AdminRow[]);
      if (index === 3) setAiUsage(result.value as { periods: AdminRow[]; users: AdminRow[]; logs: AdminRow[] });
      if (index === 4) setWaitlist(result.value as AdminRow[]);
      if (index === 5) setSiteAnalytics(result.value as AdminRow[]);
    });
    setLoadErrors(failures);
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 30_000);
    const refreshOnFocus = () => void loadDashboard();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const todayAi = aiUsage.periods.find((period) => period.id === `day-${today}`);
    const monthAi = aiUsage.periods.find((period) => period.id === `month-${month}`);
    const todaySite = siteAnalytics.find((period) => period.id === `day-${today}`);
    const monthSite = siteAnalytics.find((period) => period.id === `month-${month}`);
    const totalAiCallsThisMonth = Number(monthAi?.totalCalls ?? 0);
    const totalReflections = users.reduce((sum, user) => sum + Number(user.reflectionCount ?? 0), 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      totalUsers: users.length,
      signedInToday: users.filter((user) => {
        const loginAt = dateValue(user.lastLoginAt);
        return Boolean(loginAt && loginAt >= todayStart);
      }).length,
      activeToday: users.filter((user) => {
        const activeAt = dateValue(user.lastActiveAt);
        return Boolean(activeAt && activeAt >= todayStart);
      }).length,
      iosUsers: users.filter((user) => user.platformLastUsed === "ios").length,
      webUsers: users.filter((user) => user.platformLastUsed === "web").length,
      payingUsers: users.filter((user) => user.plan === "premium").length,
      freeUsers: users.filter((user) => user.plan !== "premium").length,
      usersWithErrors: users.filter((user) => user.lastErrorAt).length,
      openTickets: tickets.filter((ticket) => ticket.status !== "closed" && ticket.status !== "resolved").length,
      waitlistCount: waitlist.length,
      waitlistRemaining: Math.max(0, WAITLIST_MAX_SPOTS - waitlist.length),
      pageViewsToday: Number(todaySite?.pageViews ?? 0),
      uniqueVisitorsToday: Number(todaySite?.uniqueVisitors ?? 0),
      sessionsToday: Number(todaySite?.sessions ?? 0),
      pageViewsThisMonth: Number(monthSite?.pageViews ?? 0),
      uniqueVisitorsThisMonth: Number(monthSite?.uniqueVisitors ?? 0),
      aiCallsToday: Number(todayAi?.totalCalls ?? 0),
      aiCallsThisMonth: totalAiCallsThisMonth,
      getInsightsToday: featureCalls(todayAi, "daily_insight"),
      getInsightsThisMonth: featureCalls(monthAi, "daily_insight"),
      weeklyInsightsToday: featureCalls(todayAi, "weekly_summary"),
      weeklyInsightsThisMonth: featureCalls(monthAi, "weekly_summary"),
      getInsightsCostThisMonth: featureCost(monthAi, "daily_insight"),
      weeklyInsightsCostThisMonth: featureCost(monthAi, "weekly_summary"),
      aiCostToday: Number(todayAi?.estimatedCost ?? 0),
      aiCostThisMonth: Number(monthAi?.estimatedCost ?? 0),
      rejectedNonReflectionToday: Number(todayAi?.rejectedNonReflection ?? 0),
      rejectedNonReflectionThisMonth: Number(monthAi?.rejectedNonReflection ?? 0),
      averageCostPerReflection:
        totalReflections > 0 ? Number(monthAi?.estimatedCost ?? 0) / totalReflections : 0,
    };
  }, [aiUsage.periods, siteAnalytics, tickets, users, waitlist]);

  if (!firebaseConfigured()) {
    return (
      <section className="rounded-[28px] border border-edge bg-card p-5 shadow-card">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-calm">
          Admin Troubleshooting
        </p>
        <h2 className="mt-1 text-2xl font-black">Firebase not configured</h2>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          Add the `NEXT_PUBLIC_FIREBASE_*` values to enable user metadata, support tickets, and error logs.
        </p>
      </section>
    );
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-edge bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-calm">
            Admin Troubleshooting
          </p>
          <h2 className="mt-1 text-2xl font-black">Users, errors, and support</h2>
          <p className="mt-1 text-sm text-dim">
            Shows safe metadata only. Reflection text, transcripts, and generated insights are not displayed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-edge bg-ink px-3 py-2 text-[10px] font-black uppercase tracking-wide text-calm">
            Live Firestore
          </span>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-full border border-edge bg-ink px-3 py-2 text-xs font-black text-dim disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {loadErrors.length ? (
        <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          <p className="font-black">Some live dashboard data could not load.</p>
          <p className="mt-1 leading-relaxed">
            Your login is valid, but this account has not been granted Firestore admin access yet.
          </p>
          <div className="mt-3 rounded-xl border border-rose-200/20 bg-ink/35 p-3 text-xs leading-relaxed text-rose-50/90">
            <p>Create document <span className="font-black">admins/{adminUid || "your-admin-uid"}</span> with:</p>
            <p className="mt-1 font-mono">active: true</p>
            <p className="font-mono">role: &quot;admin&quot;</p>
            <p className="font-mono">email: &quot;{getFirebase()?.auth.currentUser?.email ?? "your admin email"}&quot;</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={adminDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-rose-200/25 bg-rose-100/10 px-3 py-2 text-xs font-black text-rose-50"
            >
              Open Firebase admin record
            </a>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="rounded-full border border-rose-200/25 bg-ink/40 px-3 py-2 text-xs font-black text-rose-50 disabled:opacity-50"
            >
              {loading ? "Checking..." : "I created it, retry"}
            </button>
          </div>
          <details className="mt-3 text-xs text-rose-100/70">
            <summary className="cursor-pointer font-bold">Technical details</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {loadErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </details>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total users", stats.totalUsers],
          ["Signed in today", stats.signedInToday],
          ["Active today", stats.activeToday],
          ["iOS / Web", `${stats.iosUsers} / ${stats.webUsers}`],
          ["Premium / Free", `${stats.payingUsers} / ${stats.freeUsers}`],
          ["Waitlist signups", `${stats.waitlistCount} / ${WAITLIST_MAX_SPOTS}`],
          ["Visitors today", stats.uniqueVisitorsToday],
          ["Page views today", stats.pageViewsToday],
          ["Visitors month", stats.uniqueVisitorsThisMonth],
          ["Page views month", stats.pageViewsThisMonth],
          ["Users with errors", stats.usersWithErrors],
          ["Open tickets", stats.openTickets],
          ["Get Insights today", stats.getInsightsToday],
          ["Get Insights month", stats.getInsightsThisMonth],
          ["Weekly Insights month", stats.weeklyInsightsThisMonth],
          ["AI calls today", stats.aiCallsToday],
          ["AI cost today", `$${stats.aiCostToday.toFixed(4)}`],
          ["Rejected today", stats.rejectedNonReflectionToday],
          ["Rejected this month", stats.rejectedNonReflectionThisMonth],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-edge bg-ink/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-faint">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">Site analytics</h3>
          <div className="mt-3 flex flex-col gap-2">
            {siteAnalytics.slice(0, 8).map((period) => (
              <div key={period.id} className="rounded-xl border border-edge bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black">{period.key ?? period.id}</p>
                  <span className="text-[10px] font-black uppercase text-faint">{period.period}</span>
                </div>
                <p className="mt-1 text-xs text-dim">
                  {Number(period.uniqueVisitors ?? 0)} visitors - {Number(period.pageViews ?? 0)} views - {Number(period.sessions ?? 0)} sessions
                </p>
              </div>
            ))}
            {!siteAnalytics.length ? <p className="py-6 text-center text-sm text-faint">No site visits logged yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">AI usage</h3>
          <div className="mt-3 grid gap-2">
            {[
              ["Calls this month", stats.aiCallsThisMonth],
              ["Estimated cost this month", `$${stats.aiCostThisMonth.toFixed(4)}`],
              ["Average cost per reflection", `$${stats.averageCostPerReflection.toFixed(5)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-edge bg-card p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-faint">{label}</p>
                <p className="mt-1 text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">AI feature usage</h3>
          <div className="mt-3 flex flex-col gap-2">
            {[
              ["Get Insights", stats.getInsightsToday, stats.getInsightsThisMonth, stats.getInsightsCostThisMonth],
              ["Weekly Insights", stats.weeklyInsightsToday, stats.weeklyInsightsThisMonth, stats.weeklyInsightsCostThisMonth],
            ].map(([label, todayCount, monthCount, monthCost]) => (
              <div key={label} className="rounded-xl border border-edge bg-card p-3">
                <p className="text-xs font-black">{label}</p>
                <p className="mt-1 text-xs text-dim">
                  Today: {todayCount} - Month: {monthCount} - ${Number(monthCost).toFixed(4)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">Cost by model</h3>
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(aiUsage.periods.find((period) => period.id.startsWith("month-"))?.models ?? {}).map(([model, value]: [string, any]) => (
              <div key={model} className="rounded-xl border border-edge bg-card p-3">
                <p className="text-xs font-black">{model}</p>
                <p className="mt-1 text-xs text-dim">
                  {value.calls ?? 0} calls - ${Number(value.cost ?? 0).toFixed(4)}
                </p>
              </div>
            ))}
            {!Object.keys(aiUsage.periods.find((period) => period.id.startsWith("month-"))?.models ?? {}).length ? (
              <p className="py-6 text-center text-sm text-faint">No AI usage logged yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">High-usage users</h3>
          <div className="mt-3 flex flex-col gap-2">
            {aiUsage.users.slice(0, 8).map((user) => (
              <div key={user.id} className="rounded-xl border border-edge bg-card p-3">
                <p className="text-xs font-black">{user.uid ?? user.id}</p>
                <p className="mt-1 text-xs text-dim">
                  {user.totalCalls ?? 0} calls - ${Number(user.estimatedCost ?? 0).toFixed(4)} - {user.lastFeature ?? "unknown"}
                </p>
              </div>
            ))}
            {!aiUsage.users.length ? <p className="py-6 text-center text-sm text-faint">No user AI usage yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">Cost by feature</h3>
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(aiUsage.periods.find((period) => period.id.startsWith("month-"))?.features ?? {}).map(([feature, value]: [string, any]) => (
              <div key={feature} className="rounded-xl border border-edge bg-card p-3">
                <p className="text-xs font-black">{featureLabel(feature)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">{feature}</p>
                <p className="mt-1 text-xs text-dim">
                  {value.calls ?? 0} calls - ${Number(value.cost ?? 0).toFixed(4)}
                </p>
              </div>
            ))}
            {!Object.keys(aiUsage.periods.find((period) => period.id.startsWith("month-"))?.features ?? {}).length ? (
              <p className="py-6 text-center text-sm text-faint">No feature usage logged yet.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-edge bg-ink/50 p-3">
          <h3 className="text-sm font-black text-calm">Users overview</h3>
          <div className="mt-3 grid gap-2 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="min-w-0 rounded-xl border border-edge bg-card p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 break-all text-xs font-black">{user.email ?? "No email"}</p>
                  <span className="shrink-0 rounded-full border border-edge bg-ink px-2 py-1 text-[9px] font-black uppercase text-calm">
                    {user.plan ?? "free"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[9px] font-black uppercase tracking-wide text-faint">Sign-in</p><p className="mt-0.5 break-words">{String(user.authProvider ?? "unknown").replaceAll(".com", "")}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wide text-faint">Account</p><p className="mt-0.5 break-words">{user.authStatus ?? "active"}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wide text-faint">Platform</p><p className="mt-0.5 break-words">{user.platformLastUsed ?? "unknown"}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wide text-faint">Sanctuary</p><p className="mt-0.5 break-words">{user.selectedTheme ?? "twilight"}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wide text-faint">Streak</p><p className="mt-0.5">{user.streakCount ?? 0}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wide text-faint">Reflections</p><p className="mt-0.5">{user.reflectionCount ?? 0}</p></div>
                </div>
                <p className="mt-3 break-words text-[10px] leading-relaxed text-faint">Last active: {formatDate(user.lastActiveAt)}</p>
                <p className="mt-1 break-words text-[10px] leading-relaxed text-faint">Last login: {formatDate(user.lastLoginAt)}</p>
                <p className="mt-1 break-words text-[10px] leading-relaxed text-faint">Created: {formatDate(user.createdAt)}</p>
                {user.lastErrorCode ? <p className="mt-1 break-words text-[10px] text-rose-200">Last error: {user.lastErrorCode}</p> : null}
              </article>
            ))}
            {!users.length ? <p className="py-6 text-center text-sm text-faint">No safe user profiles found yet.</p> : null}
          </div>
          <div className="mt-3 hidden max-w-full overflow-x-auto overscroll-x-contain md:block">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="text-faint">
                <tr>
                  {["Email", "Provider", "Status", "Plan", "Platform", "Theme", "Streak", "Reflections", "Created", "Last login", "Last active", "Last error"].map((heading) => (
                    <th key={heading} className="px-2 py-2 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-edge/70">
                    <td className="px-2 py-2">{user.email ?? "No email"}</td>
                    <td className="px-2 py-2">{String(user.authProvider ?? "unknown").replaceAll(".com", "")}</td>
                    <td className="px-2 py-2">{user.authStatus ?? "active"}</td>
                    <td className="px-2 py-2">{user.plan ?? "free"}</td>
                    <td className="px-2 py-2">{user.platformLastUsed ?? "unknown"}</td>
                    <td className="px-2 py-2">{user.selectedTheme ?? "twilight"}</td>
                    <td className="px-2 py-2">{user.streakCount ?? 0}</td>
                    <td className="px-2 py-2">{user.reflectionCount ?? 0}</td>
                    <td className="px-2 py-2 text-faint">{formatDate(user.createdAt)}</td>
                    <td className="px-2 py-2 text-faint">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-2 py-2 text-faint">{formatDate(user.lastActiveAt)}</td>
                    <td className="px-2 py-2 text-faint">{user.lastErrorCode ?? "None"}</td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                      <td className="px-2 py-6 text-center text-faint" colSpan={12}>
                      No safe user profiles found yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 grid gap-4">
          <div className="rounded-2xl border border-edge bg-ink/50 p-3">
            <h3 className="text-sm font-black text-calm">Open support tickets</h3>
            <div className="mt-3 flex flex-col gap-2">
              {tickets.slice(0, 8).map((ticket) => (
                <article key={ticket.id} className="rounded-xl border border-edge bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{ticket.subject ?? "No subject"}</p>
                      <p className="mt-1 text-xs text-faint">{ticket.email} - {ticket.category}</p>
                    </div>
                    <span className="rounded-full bg-ink px-2 py-1 text-[10px] font-black text-dim">
                      {ticket.status ?? "open"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-dim">
                    {ticket.message}
                  </p>
                </article>
              ))}
              {!tickets.length ? <p className="py-6 text-center text-sm text-faint">No tickets yet.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-edge bg-ink/50 p-3">
            <h3 className="text-sm font-black text-calm">Waitlist signups</h3>
            <div className="mt-3 flex flex-col gap-2">
              <div className="rounded-xl border border-edge bg-card p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-faint">Spots claimed</p>
                <p className="mt-1 text-xl font-black">{stats.waitlistCount} / {WAITLIST_MAX_SPOTS}</p>
                <p className="mt-1 text-xs text-dim">{stats.waitlistRemaining} spots left</p>
              </div>
              {waitlist.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-edge bg-card p-3">
                  <p className="text-xs font-black">{item.email ?? item.id}</p>
                  <p className="mt-1 text-xs text-dim">
                    {formatDate(item.createdAt)} - {item.recipientEmail ?? "support@tranqly.com"}
                  </p>
                </div>
              ))}
              {!waitlist.length ? <p className="py-6 text-center text-sm text-faint">No waitlist signups yet.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-edge bg-ink/50 p-3">
            <h3 className="text-sm font-black text-calm">Latest errors</h3>
            <div className="mt-3 flex flex-col gap-2">
              {errors.slice(0, 8).map((error) => (
                <article key={error.id} className="rounded-xl border border-edge bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{error.errorCode ?? "unknown_error"}</p>
                    <span className="text-xs text-faint">{error.platform ?? "unknown"}</span>
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    {error.featureArea ?? "unknown"} - {error.severity ?? "error"} - {formatDate(error.createdAt)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-dim">{error.errorMessage}</p>
                </article>
              ))}
              {!errors.length ? <p className="py-6 text-center text-sm text-faint">No recent errors.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

