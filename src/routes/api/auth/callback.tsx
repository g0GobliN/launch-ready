import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handleOAuthCallbackFn } from "@/lib/api/auth.functions";

const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/api/auth/callback")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => handleOAuthCallbackFn({ data: deps }),
});
