import { getServerConfig } from "./config.server";
import { clearAuthCookies, storeGitHubToken, storeUserInfo } from "./github-token.server";
import { createSupabaseServerClient, type CookieToSet } from "./supabase.server";
import { setCookie } from "@tanstack/react-start/server";

function applyCookies(cookies: CookieToSet[]) {
  for (const { name, value, options } of cookies) {
    setCookie(name, value, options);
  }
}

export async function signOutAuth() {
  clearAuthCookies();

  const pendingCookies: CookieToSet[] = [];
  const supabase = createSupabaseServerClient({ collectCookies: pendingCookies });
  await supabase.auth.signOut();
  applyCookies(pendingCookies);
}

export async function getGitHubOAuthUrl() {
  const { appUrl } = getServerConfig();
  if (!appUrl) throw new Error("APP_URL is not configured");

  // Clear stale Supabase session so the next OAuth flow can use a different GitHub account.
  await signOutAuth();

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

  applyCookies(pendingCookies);

  if (error || !data.url) throw new Error("Failed to initiate GitHub OAuth");
  return data.url;
}

export async function exchangeOAuthCode(code: string) {
  const pendingCookies: CookieToSet[] = [];
  const supabase = createSupabaseServerClient({ collectCookies: pendingCookies });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Must run in the route loader request so Set-Cookie headers reach the browser.
  applyCookies(pendingCookies);

  if (error) return { error: error.message };
  if (!data.session?.provider_token) {
    return {
      error:
        "GitHub token was not returned — enable the GitHub provider in Supabase and reconnect.",
    };
  }

  const u = data.session.user;
  const login = (u.user_metadata.user_name ?? u.user_metadata.preferred_username ?? "") as string;
  const email = u.email ?? "";

  storeGitHubToken(data.session.provider_token);
  storeUserInfo({
    id: u.id,
    login,
    avatarUrl: (u.user_metadata.avatar_url ?? "") as string,
    email,
  });

  // Persist email and detect new users
  if (login) {
    const { getServiceRoleClient } = await import("./supabase.server");
    const db = getServiceRoleClient();
    const { data: existing } = await db
      .from("user_credits")
      .select("github_login, email")
      .eq("github_login", login)
      .single();
    if (!existing && email) {
      const { sendWelcomeEmail } = await import("./email.server");
      sendWelcomeEmail(email, login).catch(() => {});
    }
    const upsertData: Record<string, unknown> = {
      github_login: login,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite email if GitHub returned one and DB doesn't have one yet
    if (email && !existing?.email) upsertData.email = email;
    await db.from("user_credits").upsert(upsertData, { onConflict: "github_login" });
  }

  return { error: null };
}
