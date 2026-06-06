import { createServerFn } from "@tanstack/react-start";

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
  return getStoredUser();
});

export const getUserPlanFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { getUserPlanData } = await import("../credits.server");
  const user = getStoredUser();
  if (!user) return null;
  return getUserPlanData(user.login);
});
