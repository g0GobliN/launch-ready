import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { exchangeOAuthCodeFn } from "@/lib/api/auth.functions";

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
    const { error } = await exchangeOAuthCodeFn({ data: { code: deps.code } });
    if (error) {
      throw redirect({ to: "/dashboard", search: { error } });
    }
    throw redirect({ to: "/dashboard" });
  },
});
