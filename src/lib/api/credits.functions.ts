import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCreditsBalanceFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { getCreditBalance } = await import("../credits.server");
  const user = getStoredUser();
  if (!user) return 0;
  return getCreditBalance(user.login);
});

export const getCreditHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { getCreditHistory } = await import("../credits.server");
  const user = getStoredUser();
  if (!user) return [];
  return getCreditHistory(user.login);
});

export const getSessionUserFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { isAdminUser } = await import("../admin.server");
  const user = getStoredUser();
  if (!user) return null;
  const isAdmin = await isAdminUser(user.login);
  return { ...user, isAdmin };
});

export const getUserPlanFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { getUserPlanData } = await import("../credits.server");
  const user = getStoredUser();
  if (!user) return null;
  return getUserPlanData(user.login);
});

export const getEmailNotificationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { getServiceRoleClient } = await import("../supabase.server");
  const user = getStoredUser();
  if (!user) return { enabled: true };
  const { data } = await getServiceRoleClient()
    .from("user_credits")
    .select("email_unsubscribed")
    .eq("github_login", user.login)
    .maybeSingle();
  return { enabled: data?.email_unsubscribed !== true };
});

export const setEmailNotificationsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    const { getServiceRoleClient } = await import("../supabase.server");
    const user = getStoredUser();
    if (!user) throw new Error("Not authenticated");
    await getServiceRoleClient()
      .from("user_credits")
      .update({ email_unsubscribed: !data.enabled, updated_at: new Date().toISOString() })
      .eq("github_login", user.login);
    return { enabled: data.enabled };
  });
