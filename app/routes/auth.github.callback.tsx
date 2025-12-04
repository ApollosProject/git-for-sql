import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { config } from "~/config.server";
import { createUserSession } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return redirect("/login?error=oauth_failed");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: config.github.oauth.clientId,
          client_secret: config.github.oauth.clientSecret,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("OAuth error:", tokenData);
      return redirect("/login?error=oauth_failed");
    }

    // Fetch user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const userData = await userResponse.json();

    // Fetch user emails
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const emails = await emailResponse.json();
    const primaryEmail = Array.isArray(emails)
      ? emails.find((e) => e.primary)?.email || null
      : null;

    // Create user session
    const user = {
      username: userData.login,
      email: primaryEmail || userData.email || null,
      avatar: userData.avatar_url,
      name: userData.name || null,
    };

    const sessionData = await createUserSession(user, "/");
    return redirect(sessionData.redirect, {
      headers: sessionData.headers,
    });
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return redirect("/login?error=oauth_failed");
  }
}
