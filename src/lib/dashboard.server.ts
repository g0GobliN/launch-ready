import { getRecentFixRequests, getRecentScans } from "./db.server";
import { getGitHubToken, getStoredUser } from "./github-token.server";
import { fetchGitHubRepos } from "./github.server";
import { getCreditHistory, getUserPlanData } from "./credits.server";
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
    };
  }

  const login = storedUser.login;

  const [githubRepos, recentScans, recentJobs, planData, creditHistory] = await Promise.all([
    fetchGitHubRepos(githubToken).catch(() => [] as GitHubRepo[]),
    getRecentScans(login).catch(() => []),
    getRecentFixRequests(login).catch(() => []),
    getUserPlanData(login).catch(() => null),
    getCreditHistory(login).catch(() => []),
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
  };
}
