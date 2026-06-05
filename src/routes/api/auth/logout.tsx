import { createFileRoute, redirect } from "@tanstack/react-router";
import { logoutGitHub } from "@/lib/api/github.functions";

export const Route = createFileRoute("/api/auth/logout")({
  loader: async () => {
    await logoutGitHub();
    throw redirect({ to: "/" });
  },
});
