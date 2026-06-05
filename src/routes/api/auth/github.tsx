import { createFileRoute, redirect } from "@tanstack/react-router";
import { getGitHubOAuthUrlFn } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/api/auth/github")({
  loader: async () => {
    const url = await getGitHubOAuthUrlFn();
    throw redirect({ href: url });
  },
});
