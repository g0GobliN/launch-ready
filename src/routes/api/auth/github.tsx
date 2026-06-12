import { createFileRoute, redirect } from "@tanstack/react-router";
import { getGitHubOAuthUrl } from "@/lib/auth-oauth.server";

export const Route = createFileRoute("/api/auth/github")({
  loader: async () => {
    const url = await getGitHubOAuthUrl();
    throw redirect({ href: url });
  },
});
