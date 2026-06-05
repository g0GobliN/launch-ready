import { getServerConfig } from "./config.server";
import { storeGitHubToken, storeUserInfo } from "./github-token.server";
import { createSupabaseServerClient, type CookieToSet } from "./supabase.server";
import { setCookie } from "@tanstack/react-start/server";

export async function getGitHubOAuthUrl() {
  const { appUrl } = getServerConfig();
  if (!appUrl) throw new Error("APP_URL is not configured");

  const pendingCookies: CookieToSet[] = [];
  const supabase = createSupabaseServerClient({ collectCookies: pendingCookies });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      scopes: "repo read:user",
      redirectTo: `${appUrl}/api/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  for (const { name, value, options } of pendingCookies) {
    setCookie(name, value, options);
  }

  if (error || !data.url) throw new Error("Failed to initiate GitHub OAuth");
  return data.url;
}

export async function exchangeOAuthCode(code: string) {
  const pendingCookies: CookieToSet[] = [];
  const supabase = createSupabaseServerClient({ collectCookies: pendingCookies });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Apply PKCE cleanup cookie (code-verifier deletion) — safe to set, small value.
  for (const c of pendingCookies) {
    if (c.value.length === 0) setCookie(c.name, c.value, c.options);
  }

  if (error) return { error: error.message };
  if (!data.session?.provider_token) {
    return {
      error:
        "GitHub token was not returned — enable the GitHub provider in Supabase and reconnect.",
    };
  }

  const u = data.session.user;
  storeGitHubToken(data.session.provider_token);
  storeUserInfo({
    id: u.id,
    login: (u.user_metadata.user_name ?? u.user_metadata.preferred_username ?? "") as string,
    avatarUrl: (u.user_metadata.avatar_url ?? "") as string,
    email: u.email ?? "",
  });

  return { error: null };
}
