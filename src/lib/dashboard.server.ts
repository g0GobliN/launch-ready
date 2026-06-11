import { getRecentFixRequests, getRecentScans } from "./db.server";
import { getGitHubToken, getStoredUser } from "./github-token.server";
import { fetchGitHubRepos, GitHubApiError } from "./github.server";
import { getCreditHistory, getUserPlanData } from "./credits.server";
import { getServiceRoleClient } from "./supabase.server";
import type { GitHubRepo } from "./github.server";

export async function loadDashboardData() {
  const githubToken = getGitHubToken();
  const storedUser = getStoredUser();

  if (!githubToken || !storedUser) {
    return {
      user: null,
      githubRepos: [] as GitHubRepo[],
      recentScans: [],
      recentJobs: [],
      planData: null,
      creditHistory: [],
      tokenExpired: false,
      emailNotificationsEnabled: true,
    };
  }

  const login = storedUser.login;
  let tokenExpired = false;

  const [githubRepos, recentScans, recentJobs, planData, creditHistory, emailRow] =
    await Promise.all([
      fetchGitHubRepos(githubToken).catch((e) => {
        if (e instanceof GitHubApiError && e.status === 401) tokenExpired = true;
        else console.error("[dashboard] fetchGitHubRepos failed:", e);
        return [] as GitHubRepo[];
      }),
      getRecentScans(login).catch(() => []),
      getRecentFixRequests(login).catch(() => []),
      getUserPlanData(login).catch(() => null),
      getCreditHistory(login).catch(() => []),
      (async () => {
        const { data } = await getServiceRoleClient()
          .from("user_credits")
          .select("email_unsubscribed")
          .eq("github_login", login)
          .maybeSingle();
        return data;
      })().catch(() => null),
    ]);

  return {
    user: {
      id: storedUser.id,
      login,
      avatarUrl: storedUser.avatarUrl,
      email: storedUser.email,
    },
    githubRepos,
    recentScans,
    recentJobs,
    planData,
    creditHistory,
    tokenExpired,
    emailNotificationsEnabled: emailRow?.email_unsubscribed !== true,
  };
}
