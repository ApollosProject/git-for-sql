import { createCookieSessionStorage } from "@remix-run/node";
import { config } from "~/config.server";

export interface GitHubUser {
  username: string;
  email: string | null;
  avatar: string;
  name: string | null;
}

// Session storage
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [config.sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function getUserFromSession(
  request: Request
): Promise<GitHubUser | null> {
  const session = await getSession(request);
  const user = session.get("user");
  return user || null;
}

export async function createUserSession(user: GitHubUser, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("user", user);
  return {
    redirect: redirectTo,
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  };
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return {
    redirect: "/",
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  };
}
