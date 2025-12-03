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
import { getOpenPRsWithSQL } from "~/lib/github.server";

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

  // Fetch open PRs with SQL files (for "In Review" column)
  // This is fetched fresh on every loader call (including auto-refresh)
  let openPRs: Array<{
    prNumber: number;
    title: string;
    url: string;
    author: string;
    createdAt: string;
    sqlFiles: Array<{ filename: string; status: string }>;
  }> = [];
  try {
    openPRs = await getOpenPRsWithSQL();
  } catch (error) {
    console.error("[Dashboard] Error fetching open PRs:", error);
    // Continue with empty array if PR fetch fails
  }

  return json(
    { pending, readyForProd, completed, openPRs, user },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

export default function Index() {
  const { pending, readyForProd, completed, openPRs, user } =
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Approved SQL Scripts</h2>
        <p className="text-gray-500 text-sm">
          All scripts must be executed in staging first, then can be promoted to
          production. Add{" "}
          <code className="bg-gray-100 px-1 rounded">-- DirectProd</code> in
          script comments to bypass staging requirement.
        </p>
      </div>

      {totalScripts === 0 && openPRs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-500">No scripts available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* In Review Column */}
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col max-h-[calc(100vh-250px)]">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <span className="text-purple-500 text-xl">🔍</span>
              <h3 className="text-lg font-semibold text-gray-800">In Review</h3>
              <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded-full">
                {openPRs.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
              {openPRs.length > 0 ? (
                openPRs.map((pr) => <PRCard key={pr.prNumber} pr={pr} />)
              ) : (
                <div className="text-gray-400 text-sm text-center py-8">
                  No open PRs
                </div>
              )}
            </div>
          </div>

          {/* Pending Staging Column */}
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col max-h-[calc(100vh-250px)]">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <span className="text-amber-500 text-xl">⏳</span>
              <h3 className="text-lg font-semibold text-gray-800">
                Pending Staging
              </h3>
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded-full">
                {pending.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
              {pending.length > 0 ? (
                pending.map((script) => (
                  <KanbanCard key={script.id} script={script} />
                ))
              ) : (
                <div className="text-gray-400 text-sm text-center py-8">
                  No scripts pending
                </div>
              )}
            </div>
          </div>

          {/* Ready for Production Column */}
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col max-h-[calc(100vh-250px)]">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <span className="text-blue-500 text-xl">✅</span>
              <h3 className="text-lg font-semibold text-gray-800">
                Ready for Prod
              </h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">
                {readyForProd.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
              {readyForProd.length > 0 ? (
                readyForProd.map((script) => (
                  <KanbanCard key={script.id} script={script} />
                ))
              ) : (
                <div className="text-gray-400 text-sm text-center py-8">
                  No scripts ready
                </div>
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col max-h-[calc(100vh-250px)]">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <span className="text-green-500 text-xl">✓</span>
              <h3 className="text-lg font-semibold text-gray-800">Completed</h3>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
                {completed.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
              {completed.length > 0 ? (
                completed.map((script) => (
                  <KanbanCard key={script.id} script={script} />
                ))
              ) : (
                <div className="text-gray-400 text-sm text-center py-8">
                  No scripts completed
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PR Card Component (for In Review column)
function PRCard({ pr }: { pr: any }) {
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
    <a
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer no-underline"
    >
      <h4 className="text-sm font-semibold text-gray-800 mb-2 line-clamp-2">
        {pr.title}
      </h4>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-900">
          PR #{pr.prNumber}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>👤 {pr.author}</span>
        {pr.createdAt && <span>📅 {formatRelativeTime(pr.createdAt)}</span>}
      </div>
    </a>
  );
}

// Compact Kanban Card Component
function KanbanCard({ script }: { script: any }) {
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

  // Get primary status badge
  const getPrimaryStatus = () => {
    if (script.production_executed) {
      return { text: "✓ Production", color: "bg-green-100 text-green-900" };
    }
    if (script.staging_executed) {
      return { text: "✓ Staging", color: "bg-green-100 text-green-900" };
    }
    return { text: "⏳ Pending", color: "bg-yellow-100 text-yellow-900" };
  };

  const primaryStatus = getPrimaryStatus();
  const hasErrors = script.hasErrors;
  const executionCount = script.executionCount || 0;

  return (
    <a
      href={`/scripts/${script.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer no-underline"
    >
      <h4 className="text-sm font-semibold text-gray-800 mb-2 truncate">
        {script.script_name}
      </h4>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${primaryStatus.color}`}
        >
          {primaryStatus.text}
        </span>

        {script.direct_prod && (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-900">
            ⚡ DirectProd
          </span>
        )}

        {hasErrors && (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-900">
            ⚠️ Errors
          </span>
        )}

        {executionCount > 0 && (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            🔄 {executionCount}x
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        {script.approved_at && (
          <span>📅 {formatRelativeTime(script.approved_at)}</span>
        )}
        {approvers.length > 0 && <span>👥 {approvers.length}</span>}
      </div>
    </a>
  );
}

// Full Script Card (kept for potential future use or detail views)
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
