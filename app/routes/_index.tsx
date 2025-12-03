import { json, redirect } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { useEffect } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  getApprovedScripts,
  getExistingScriptNames,
  getScriptExecutionHistory,
} from "~/lib/db.server";
import type { ApprovedScript } from "~/lib/types";
import { getUserFromSession } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require authentication
  const user = await getUserFromSession(request);
  if (!user) {
    throw redirect("/login");
  }

  // Load scripts from database
  const scripts = await getApprovedScripts();

  // Get execution stats for each script
  const scriptsWithStats = await Promise.all(
    scripts.map(async (script) => {
      const history = await getScriptExecutionHistory(script.script_name);
      const successfulExecutions = history.filter(
        (e) => e.status === "success"
      );
      const lastExecution = history[0] || null;
      const executionCount = history.length;

      // Determine workflow state for sorting
      let workflowState: "pending" | "ready" | "completed" = "pending";
      if (script.production_executed) {
        workflowState = "completed";
      } else if (script.staging_executed) {
        workflowState = "ready";
      }

      return {
        ...script,
        executionCount,
        lastExecution,
        lastExecutedBy: lastExecution?.executed_by || null,
        lastExecutedAt: lastExecution?.executed_at || null,
        hasErrors: history.some((e) => e.status === "error"),
        workflowState,
      };
    })
  );

  // Sort scripts: pending first, then ready for prod, then completed
  // Within each group, sort by most relevant timestamp (newest first)
  scriptsWithStats.sort((a, b) => {
    const stateOrder = { pending: 0, ready: 1, completed: 2 };
    const stateDiff = stateOrder[a.workflowState] - stateOrder[b.workflowState];
    if (stateDiff !== 0) return stateDiff;

    // Within same state, sort by most relevant timestamp (newest first)
    let aTime: number;
    let bTime: number;

    if (a.workflowState === "pending") {
      // Pending: sort by approved_at (newest approved first)
      aTime = new Date(a.approved_at).getTime();
      bTime = new Date(b.approved_at).getTime();
    } else if (a.workflowState === "ready") {
      // Ready for prod: sort by staging_executed_at (newest staging execution first)
      aTime = a.staging_executed_at
        ? new Date(a.staging_executed_at).getTime()
        : 0;
      bTime = b.staging_executed_at
        ? new Date(b.staging_executed_at).getTime()
        : 0;
    } else {
      // Completed: sort by production_executed_at (newest production execution first)
      aTime = a.production_executed_at
        ? new Date(a.production_executed_at).getTime()
        : 0;
      bTime = b.production_executed_at
        ? new Date(b.production_executed_at).getTime()
        : 0;
    }

    return bTime - aTime; // Newest first
  });

  // Group scripts by workflow state
  const pending = scriptsWithStats.filter((s) => s.workflowState === "pending");
  const readyForProd = scriptsWithStats.filter(
    (s) => s.workflowState === "ready"
  );
  const completed = scriptsWithStats.filter(
    (s) => s.workflowState === "completed"
  );

  return json({ pending, readyForProd, completed, user });
}

export default function Index() {
  const { pending, readyForProd, completed, user } =
    useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  const totalScripts = pending.length + readyForProd.length + completed.length;

  // Auto-refresh every 30 seconds to pick up new scripts from webhooks
  useEffect(() => {
    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [revalidator]);

  return (
    <div>
      <div className="mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold m-0">Approved SQL Scripts</h2>
          </div>
          <p className="text-gray-500">
            All scripts must be executed in staging first, then can be promoted
            to production. Add{" "}
            <code className="bg-gray-100 px-1 rounded">-- DirectProd</code> in
            script comments to bypass staging requirement.
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-amber-500">
            ⏳ Pending Staging Execution ({pending.length})
          </h3>
          <div>
            {pending.map((script) => (
              <ScriptCard key={script.id} script={script} />
            ))}
          </div>
        </div>
      )}

      {readyForProd.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-blue-500">
            ✅ Ready for Production ({readyForProd.length})
          </h3>
          <div>
            {readyForProd.map((script) => (
              <ScriptCard key={script.id} script={script} />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-green-500">
            ✓ Completed ({completed.length})
          </h3>
          <div>
            {completed.map((script) => (
              <ScriptCard key={script.id} script={script} />
            ))}
          </div>
        </div>
      )}

      {totalScripts === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
          <p className="text-gray-500">No scripts available</p>
        </div>
      )}
    </div>
  );
}

function ScriptCard({ script }: { script: any }) {
  const approvers = Array.isArray(script.approvers)
    ? script.approvers
    : script.approvers
    ? JSON.parse(script.approvers as any)
    : [];

  // Format relative time
  const formatRelativeTime = (date: Date | string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-semibold mb-2">{script.script_name}</h4>
          <div className="flex gap-2 flex-wrap mb-2">
            {/* Execution Status Badges */}
            {script.staging_executed && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-900"
                title={
                  script.staging_executed_at
                    ? `Staging executed ${formatRelativeTime(
                        script.staging_executed_at
                      )}`
                    : "Staging executed"
                }
              >
                ✓ Staging
              </span>
            )}
            {script.production_executed && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-900"
                title={
                  script.production_executed_at
                    ? `Production executed ${formatRelativeTime(
                        script.production_executed_at
                      )}`
                    : "Production executed"
                }
              >
                ✓ Production
              </span>
            )}
            {!script.staging_executed && !script.production_executed && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-900">
                ⏳ Pending Staging
              </span>
            )}
            {script.staging_executed && !script.production_executed && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-900">
                ✅ Ready for Prod
              </span>
            )}

            {/* Feature Flags */}
            {script.direct_prod && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-200 text-amber-900"
                title="Can execute directly on production"
              >
                ⚡ DirectProd
              </span>
            )}

            {/* Approval Info */}
            {approvers.length > 0 && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-900"
                title={`Approved by: ${approvers.join(", ")}`}
              >
                👥 {approvers.length} approver
                {approvers.length !== 1 ? "s" : ""}
              </span>
            )}

            {/* Execution Stats */}
            {script.executionCount > 0 && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700"
                title={`Executed ${script.executionCount} time${
                  script.executionCount !== 1 ? "s" : ""
                }`}
              >
                🔄 {script.executionCount}x
              </span>
            )}

            {/* Error Indicator */}
            {script.hasErrors && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-900"
                title="Has execution errors"
              >
                ⚠️ Errors
              </span>
            )}

            {/* Last Execution Info */}
            {script.lastExecutedAt && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-900"
                title={`Last executed ${formatRelativeTime(
                  script.lastExecutedAt
                )} by ${script.lastExecutedBy}`}
              >
                🕒 {formatRelativeTime(script.lastExecutedAt)}
              </span>
            )}

            {/* Approved Date */}
            {script.approved_at && (
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-900"
                title={`Approved ${formatRelativeTime(script.approved_at)}`}
              >
                📅 Approved {formatRelativeTime(script.approved_at)}
              </span>
            )}
          </div>
          {script.github_pr_url && (
            <a
              href={script.github_pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 text-sm no-underline hover:underline"
            >
              View PR →
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={`/scripts/${script.id}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors no-underline"
          >
            View Details
          </a>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-gray-500 text-sm mb-2">
          Show SQL
        </summary>
        <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
          {script.script_content}
        </pre>
      </details>

      {approvers.length > 0 && (
        <div className="mt-3 text-sm text-gray-500">
          <strong>Approved by:</strong> {approvers.join(", ")}
        </div>
      )}
    </div>
  );
}
