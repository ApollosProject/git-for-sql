import { json } from "~/lib/json.server";
import type { ActionFunctionArgs } from "react-router";
import {
  verifyWebhookSignature,
  getPRApprovers,
  getPRFiles,
  fetchScriptFromGitHub,
  extractTargetDatabase,
  parseSQLMetadata,
} from "~/lib/github.server";
import { addApprovedScript } from "~/lib/audit.server";
import { config } from "~/config.server";

export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Get the webhook signature
  const signature = request.headers.get("x-hub-signature-256") || "";

  // Get the raw body
  const payload = await request.text();

  // Verify the webhook signature
  if (!verifyWebhookSignature(payload, signature)) {
    console.error("❌ [Webhook] Invalid signature");
    return json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse the payload
  let data;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    console.error("❌ [Webhook] Failed to parse JSON:", error);
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle merged pull requests
  if (data.action !== "closed" || !data.pull_request?.merged) {
    return json({ message: "Not a merged PR, ignoring" }, { status: 200 });
  }

  const prNumber = data.pull_request.number;
  const prUrl = data.pull_request.html_url;

  console.log(`📥 [Webhook] Processing merged PR #${prNumber}`);

  // Get PR approvers
  const approvers = await getPRApprovers(prNumber);

  // Check if PR has enough approvals
  if (approvers.length < config.minApprovals) {
    console.log(
      `   ⚠️  Insufficient approvals (${approvers.length}/${config.minApprovals})`
    );
    return json(
      {
        message: `Insufficient approvals (${approvers.length}/${config.minApprovals})`,
      },
      { status: 200 }
    );
  }

  // Get files changed in the PR
  const files = await getPRFiles(prNumber);

  // Filter for SQL files in specified folder (or entire repo if folder not set)
  const sqlFolder = config.github.sqlFolder;
  const sqlFiles = files.filter((f) => {
    const isSqlFile = f.filename.endsWith(".sql") && f.status !== "removed";
    if (!isSqlFile) return false;

    // If folder is specified, only include files in that folder
    if (sqlFolder) {
      return f.filename.startsWith(sqlFolder);
    }

    // No folder restriction - include all SQL files
    return true;
  });

  if (sqlFiles.length === 0) {
    const folderInfo = sqlFolder ? ` in folder '${sqlFolder}'` : "";
    console.log(`   ⚠️  No SQL files found${folderInfo}`);
    return json(
      { message: `No SQL files found in PR${folderInfo}` },
      { status: 200 }
    );
  }

  // Process each SQL file
  const results = [];
  for (const file of sqlFiles) {
    const scriptName = file.filename.split("/").pop() || file.filename;

    // Fetch the file content first to parse metadata
    const content = await fetchScriptFromGitHub(file.filename);

    if (!content) {
      console.log(`   ❌ Failed to fetch: ${scriptName}`);
      continue;
    }

    // Parse metadata to check for DirectProd flag
    const metadata = parseSQLMetadata(content);
    const directProd = metadata.directProd === true;

    // Extract target database (defaults to staging for new workflow)
    const targetDb = extractTargetDatabase(file.filename, content) || "staging";

    // Add to approved scripts
    const success = await addApprovedScript({
      scriptName,
      scriptContent: content,
      targetDatabase: targetDb,
      githubPrUrl: prUrl,
      approvers,
      directProd,
    });

    if (success) {
      const directProdFlag = directProd ? " (DirectProd)" : "";
      console.log(`   ✓ Added: ${scriptName} → ${targetDb}${directProdFlag}`);
    } else {
      console.log(`   ❌ Failed to add: ${scriptName}`);
    }

    results.push({
      filename: file.filename,
      success,
      targetDatabase: targetDb,
    });
  }

  return json(
    {
      message: "Webhook processed successfully",
      prNumber,
      approvers,
      processedFiles: results,
    },
    { status: 200 }
  );
}
