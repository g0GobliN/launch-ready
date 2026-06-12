import { createFileRoute } from "@tanstack/react-router";
import { getGitHubOAuthUrlFn } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/api/auth/github")({
  loader: () => getGitHubOAuthUrlFn(),
});
