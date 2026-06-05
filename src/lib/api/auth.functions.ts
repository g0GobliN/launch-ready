import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getGitHubOAuthUrlFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getGitHubOAuthUrl } = await import("../auth-oauth.server");
  return getGitHubOAuthUrl();
});

export const exchangeOAuthCodeFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data }) => {
    const { exchangeOAuthCode } = await import("../auth-oauth.server");
    return exchangeOAuthCode(data.code);
  });
