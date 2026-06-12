import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { exchangeOAuthCode } from "@/lib/auth-oauth.server";

const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/api/auth/callback")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (deps.error) {
      throw redirect({ to: "/dashboard", search: { error: deps.error } });
    }
    if (!deps.code) {
      throw redirect({ to: "/dashboard", search: { error: "missing_code" } });
    }
    const { error } = await exchangeOAuthCode(deps.code);
    if (error) {
      throw redirect({ to: "/dashboard", search: { error } });
    }
    throw redirect({ to: "/dashboard" });
  },
});
