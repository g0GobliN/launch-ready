import { getServiceRoleClient } from "./supabase.server";

function bootstrapAdminLogins(): string[] {
  return (process.env.ADMIN_GITHUB_LOGIN ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(login: string): boolean {
  const key = login.trim().toLowerCase();
  return bootstrapAdminLogins().includes(key);
}

/** Server-side admin check: env bootstrap list or user_credits.is_admin */
export async function isAdminUser(login: string | undefined): Promise<boolean> {
  if (!login) return false;
  if (isBootstrapAdmin(login)) return true;

  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("is_admin")
    .eq("github_login", login)
    .maybeSingle();
  return data?.is_admin === true;
}
