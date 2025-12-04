import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { config } from "~/config.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { clientId, callbackUrl } = config.github.oauth;

  if (!clientId) {
    throw new Error("GitHub OAuth Client ID not configured");
  }

  // Build GitHub OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "read:user user:email",
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params}`;

  return redirect(githubAuthUrl);
}
