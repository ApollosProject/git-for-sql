import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { logout } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const sessionData = await logout(request);
  return redirect(sessionData.redirect, {
    headers: sessionData.headers,
  });
}

export async function loader() {
  return redirect("/");
}
