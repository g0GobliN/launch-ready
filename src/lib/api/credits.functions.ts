import { createServerFn } from "@tanstack/react-start";
import { getCreditBalance, getCreditHistory, getUserPlanData } from "../credits.server";

export const getCreditsBalanceFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const user = getStoredUser();
  if (!user) return 0;
  return getCreditBalance(user.login);
});

export const getCreditHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const user = getStoredUser();
  if (!user) return [];
  return getCreditHistory(user.login);
});

export const getUserPlanFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const user = getStoredUser();
  if (!user) return null;
  return getUserPlanData(user.login);
});
