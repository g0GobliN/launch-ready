import { deleteCookie, getCookies, setCookie } from "@tanstack/react-start/server";

const GITHUB_TOKEN_COOKIE = "lr_github_token";
const USER_INFO_COOKIE = "lr_user";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
};

export type StoredUser = {
  id: string;
  login: string;
  avatarUrl: string;
  email: string;
};

export function storeGitHubToken(token: string) {
  setCookie(GITHUB_TOKEN_COOKIE, token, COOKIE_OPTS);
}

export function getGitHubToken(): string | null {
  return getCookies()[GITHUB_TOKEN_COOKIE] ?? null;
}

export function storeUserInfo(user: StoredUser) {
  setCookie(USER_INFO_COOKIE, Buffer.from(JSON.stringify(user)).toString("base64"), COOKIE_OPTS);
}

export function getStoredUser(): StoredUser | null {
  const raw = getCookies()[USER_INFO_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as StoredUser;
  } catch {
    return null;
  }
}

export function clearAuthCookies() {
  deleteCookie(GITHUB_TOKEN_COOKIE, { path: "/" });
  deleteCookie(USER_INFO_COOKIE, { path: "/" });
}
