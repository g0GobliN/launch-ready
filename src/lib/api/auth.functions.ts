import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";

/** Starts GitHub OAuth — sets PKCE cookies and redirects in the same server-fn response. */
export const getGitHubOAuthUrlFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getGitHubOAuthUrl } = await import("../auth-oauth.server");
  const url = await getGitHubOAuthUrl();
  throw redirect({ href: url });
});

/** Exchanges OAuth code — cookies + redirect must stay inside one server-fn call. */
export const handleOAuthCallbackFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      code: z.string().optional(),
      error: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.error) {
      throw redirect({ to: "/dashboard", search: { error: data.error } });
    }
    if (!data.code) {
      throw redirect({ to: "/dashboard", search: { error: "missing_code" } });
    }
    const { exchangeOAuthCode } = await import("../auth-oauth.server");
    const { error } = await exchangeOAuthCode(data.code);
    if (error) {
      throw redirect({ to: "/dashboard", search: { error } });
    }
    throw redirect({ to: "/dashboard" });
  });
