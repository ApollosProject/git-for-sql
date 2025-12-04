import { json } from "~/lib/json.server";
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { syncScriptsFromGitHub } from "~/lib/github.server";
import { addApprovedScript } from "~/lib/audit.server";
import { getExistingScriptNames } from "~/lib/db.server";
import { getUserFromSession } from "~/lib/auth.server";
import { config } from "~/config.server";

export async function action({ request }: ActionFunctionArgs) {
  // Require authentication
  const user = await getUserFromSession(request);
  if (!user) {
    throw redirect("/login");
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  console.log(`🔄 [Sync] Manual sync triggered by ${user.username}`);

  const stats = await syncScriptsFromGitHub(
    addApprovedScript,
    getExistingScriptNames,
    config.minApprovals
  );

  return json({
    success: true,
    message: "Sync completed",
    stats,
  });
}

