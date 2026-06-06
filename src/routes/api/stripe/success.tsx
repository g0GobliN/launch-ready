import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { activatePlanFn } from "@/lib/api/stripe.functions";

export const Route = createFileRoute("/api/stripe/success")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!deps.session_id) {
      throw redirect({ to: "/pricing" });
    }
    try {
      await activatePlanFn({ data: { sessionId: deps.session_id } });
    } catch {
      // if already activated or session invalid, just go to dashboard
    }
    throw redirect({ to: "/dashboard" });
  },
});
