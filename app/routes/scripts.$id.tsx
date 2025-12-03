import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  getScriptById,
  executeSQL,
  getScriptExecutionHistory,
  canExecuteOnProduction,
  updateScriptExecutionStatus,
} from "~/lib/db.server";
import { logExecution } from "~/lib/audit.server";
import { useState, useEffect, useRef } from "react";
import type { ExecutionLog } from "~/lib/types";
import { getUserFromSession } from "~/lib/auth.server";
import {
  Check,
  Clock,
  CheckCircle,
  Warning,
  Lightning,
  X,
  Info,
} from "phosphor-react";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "~/components/Table";
import { DetailsDrawer } from "~/components/DetailsDrawer";

export async function loader({ params, request }: LoaderFunctionArgs) {
  // Require authentication
  const user = await getUserFromSession(request);
  if (!user) {
    throw redirect("/login");
  }

  const scriptId = parseInt(params.id || "0");
  const script = await getScriptById(scriptId);

  if (!script) {
    throw new Response("Script not found", { status: 404 });
  }

  const history = await getScriptExecutionHistory(script.script_name);

  return json({ script, history, user });
}

export async function action({ request, params }: ActionFunctionArgs) {
  // Require authentication
  const user = await getUserFromSession(request);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const scriptId = parseInt(params.id || "0");
  const script = await getScriptById(scriptId);

  if (!script) {
    return json({ error: "Script not found" }, { status: 404 });
  }

  // Get form data
  const formData = await request.formData();
  const targetDatabase =
    (formData.get("targetDatabase") as string) || "staging";

  // Use authenticated user's email or username (always available since user is authenticated)
  const executedBy = (user.email || user.username || "unknown").trim();

  // Enforce staging-first workflow (unless direct_prod flag is set)
  if (targetDatabase === "production") {
    const canExecute = await canExecuteOnProduction(scriptId);
    if (!canExecute) {
      return json({
        success: false,
        error:
          "Script must be executed successfully in staging first, or have -- DirectProd flag set",
      });
    }
  }

  // Execute the SQL
  const result = await executeSQL(
    targetDatabase as "staging" | "production",
    script.script_content
  );

  // Log the execution (always log, even on error)
  try {
    await logExecution({
      scriptName: script.script_name,
      scriptContent: script.script_content,
      executedBy: executedBy,
      targetDatabase: targetDatabase as "staging" | "production",
      status: result.success ? "success" : "error",
      rowsAffected: result.rowsAffected,
      errorMessage: result.error,
      executionTimeMs: result.executionTime,
      githubPrUrl: script.github_pr_url || undefined,
      approvers: Array.isArray(script.approvers) ? script.approvers : [],
      resultData: result.resultRows,
    });
  } catch (logError: any) {
    console.error(`Failed to log execution:`, logError);
    // Continue even if logging fails
  }

  // Update script execution status if successful
  if (result.success) {
    try {
      await updateScriptExecutionStatus(
        scriptId,
        targetDatabase as "staging" | "production"
      );
    } catch (markError: any) {
      console.error(`Failed to update script status:`, markError);
    }
  }

  if (result.success) {
    const hasResults = result.resultRows && result.resultRows.length > 0;
    const resultMsg = hasResults
      ? `Returned ${result.resultRows?.length || 0} row${
          (result.resultRows?.length || 0) !== 1 ? "s" : ""
        }`
      : `${result.rowsAffected || 0} row${
          (result.rowsAffected || 0) !== 1 ? "s" : ""
        } affected`;
    return json({
      success: true,
      message: `Successfully executed. ${resultMsg} in ${result.executionTime}ms`,
    });
  } else {
    return json({
      success: false,
      error: result.error || "Execution failed with unknown error",
    });
  }
}

export default function ScriptDetail() {
  const { script, history, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [showConfirm, setShowConfirm] = useState(false);
  const [targetDatabase, setTargetDatabase] = useState<
    "staging" | "production"
  >("staging");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const prevNavigationState = useRef<string>(navigation.state);
  const wasSubmitting = useRef<boolean>(false);

  const openDrawer = (entry: any) => {
    setSelectedEntry(entry);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedEntry(null);
  };

  const isExecuting = navigation.state === "submitting";

  // Track when we start submitting
  useEffect(() => {
    if (navigation.state === "submitting") {
      wasSubmitting.current = true;
    }
  }, [navigation.state]);

  // Close modal and refresh data when execution completes
  useEffect(() => {
    // Close modal if we were submitting, now idle, and have actionData
    if (
      wasSubmitting.current &&
      navigation.state === "idle" &&
      actionData &&
      showConfirm
    ) {
      wasSubmitting.current = false;
      setShowConfirm(false);
      // Refresh loader data to get updated execution status
      if ("success" in actionData && actionData.success) {
        revalidator.revalidate();
      }
    }
  }, [navigation.state, actionData, showConfirm, revalidator]);

  const approvers = Array.isArray(script.approvers)
    ? script.approvers
    : script.approvers
    ? JSON.parse(script.approvers as any)
    : [];

  // Determine workflow state
  const stagingExecuted = script.staging_executed === true;
  const productionExecuted = script.production_executed === true;
  const directProd = script.direct_prod === true;
  const canExecuteProduction = stagingExecuted || directProd;

  return (
    <div>
      <div className="mb-8">
        <a
          href="/"
          className="text-blue-600 hover:text-blue-800 no-underline text-sm"
        >
          ← Back to Dashboard
        </a>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">{script.script_name}</h2>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {stagingExecuted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-900">
              <Check size={14} weight="bold" />
              Staging Executed
            </span>
          )}
          {productionExecuted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-900">
              <Check size={14} weight="bold" />
              Production Executed
            </span>
          )}
          {!stagingExecuted && !productionExecuted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-900">
              <Clock size={14} weight="bold" />
              Pending Staging Execution
            </span>
          )}
          {stagingExecuted && !productionExecuted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-900">
              <CheckCircle size={14} weight="bold" />
              Ready for Production
            </span>
          )}
          {directProd && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
              <Lightning size={14} weight="bold" />
              Direct Production Allowed
            </span>
          )}
          {approvers.length > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              {approvers.length} approver{approvers.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Metadata Section */}
        <div className="mb-6 space-y-3">
          {script.github_pr_url && (
            <div>
              <a
                href={script.github_pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 no-underline text-sm font-medium"
              >
                View GitHub PR →
              </a>
            </div>
          )}

          {approvers.length > 0 && (
            <p className="text-sm text-gray-600">
              <strong>Approved by:</strong> {approvers.join(", ")}
            </p>
          )}
        </div>

        {/* SQL Script Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">
            SQL Script
          </h3>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            {script.script_content}
          </pre>
        </div>

        {/* Action Messages */}
        {actionData && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              "success" in actionData && actionData.success
                ? "bg-green-50 border border-green-200 text-green-900"
                : "bg-red-50 border border-red-200 text-red-900"
            }`}
          >
            {"success" in actionData && actionData.success
              ? "message" in actionData
                ? actionData.message
                : "Success"
              : `Error: ${
                  "error" in actionData ? actionData.error : "Unknown error"
                }`}
          </div>
        )}

        {isExecuting && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-900">
            Executing script... Please wait.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => {
              setTargetDatabase("staging");
              setShowConfirm(true);
            }}
            className="btn btn-primary"
            disabled={isExecuting}
          >
            {isExecuting ? "Executing..." : "Execute on Staging"}
          </button>
          {canExecuteProduction && (
            <button
              onClick={() => {
                setTargetDatabase("production");
                setShowConfirm(true);
              }}
              className="btn btn-danger"
              disabled={isExecuting}
            >
              {isExecuting ? "Executing..." : "Execute on Production"}
            </button>
          )}
          {!canExecuteProduction && !stagingExecuted && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
              <Warning size={16} weight="bold" />
              <span>
                Execute on staging first, or add{" "}
                <code className="bg-yellow-100 px-1 rounded">
                  -- DirectProd
                </code>{" "}
                flag to bypass
              </span>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="card mt-8">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">
            Execution History
          </h3>
          <Table>
            <TableHeader>
              <TableHeaderCell>Executed By</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Rows Affected</TableHeaderCell>
              <TableHeaderCell>Time</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Results</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <ExecutionHistoryRow
                  key={entry.id}
                  entry={entry}
                  onOpenDetails={openDrawer}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showConfirm && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowConfirm(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
              <Warning size={24} weight="bold" />
              Confirm Execution
            </h3>

            <p className="mb-4">
              You are about to execute SQL against the{" "}
              <strong
                className={
                  targetDatabase === "production"
                    ? "text-red-600"
                    : "text-blue-600"
                }
              >
                {targetDatabase}
              </strong>{" "}
              database.
            </p>

            {targetDatabase === "production" &&
              !stagingExecuted &&
              directProd && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <strong className="flex items-center gap-1 text-yellow-900">
                    <Warning size={16} weight="bold" />
                    Direct Production Execution
                  </strong>
                  <p className="mt-2 text-sm text-yellow-800">
                    This script has the{" "}
                    <code className="bg-yellow-100 px-1 rounded">
                      -- DirectProd
                    </code>{" "}
                    flag, allowing direct production execution without staging.
                  </p>
                </div>
              )}

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm font-semibold mb-2 text-gray-900">
                Script: {script.script_name}
              </p>
              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                {script.script_content}
              </pre>
            </div>

            <Form method="post">
              <p className="mb-4 text-sm text-gray-600">
                This action will be logged in the audit trail as{" "}
                <strong className="text-gray-900">
                  {user?.email || user?.username || "you"}
                </strong>
                .
              </p>

              <input
                type="hidden"
                name="targetDatabase"
                value={targetDatabase}
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${
                    targetDatabase === "production"
                      ? "btn-danger"
                      : "btn-primary"
                  }`}
                >
                  Yes, Execute on {targetDatabase}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      {selectedEntry && (
        <DetailsDrawer
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
          entry={selectedEntry}
        />
      )}
    </div>
  );
}

// Component for rendering execution history rows
function ExecutionHistoryRow({
  entry,
  onOpenDetails,
}: {
  entry: any;
  onOpenDetails: (entry: any) => void;
}) {
  // Parse result_data if it's a string (shouldn't happen with JSONB, but handle it)
  let resultData = entry.result_data;
  if (resultData && typeof resultData === "string") {
    try {
      resultData = JSON.parse(resultData);
    } catch (e) {
      resultData = null;
    }
  }

  const hasResults =
    resultData && Array.isArray(resultData) && resultData.length > 0;

  // Check if script content is a SELECT query (to detect if results should have been captured)
  const scriptContent = entry.script_content || "";
  const sqlClean = scriptContent
    .replace(/--.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .trim()
    .toUpperCase();
  const isSelectQuery = sqlClean.startsWith("SELECT");

  // Determine result display message
  let resultDisplay;
  if (hasResults) {
    resultDisplay = null; // Will show button
  } else if (isSelectQuery && entry.rows_affected && entry.rows_affected > 0) {
    // SELECT query with rows but no results captured (likely executed before feature was added)
    resultDisplay = (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
        title="This SELECT query returned rows, but results weren't captured (likely executed before result capture feature was added). Re-execute to see results."
      >
        <Warning size={14} weight="bold" />
        Not captured
      </span>
    );
  } else {
    // DDL/DML query - no results expected
    resultDisplay = (
      <span
        className="inline-flex items-center gap-1.5 text-gray-500 text-sm"
        title="Results are only available for SELECT queries. DDL/DML queries show row count in 'Rows Affected' column."
      >
        N/A
        <Info size={14} weight="regular" className="text-gray-400" />
      </span>
    );
  }

  if (!hasResults) {
    return (
      <TableRow>
        <TableCell>{entry.executed_by}</TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              entry.target_database === "production"
                ? "bg-red-100 text-red-900"
                : "bg-blue-100 text-blue-900"
            }`}
          >
            {entry.target_database}
          </span>
        </TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              entry.status === "success"
                ? "bg-green-100 text-green-900"
                : "bg-red-100 text-red-900"
            }`}
          >
            {entry.status}
          </span>
        </TableCell>
        <TableCell className="text-gray-700">
          {entry.rows_affected !== null ? entry.rows_affected : "N/A"}
        </TableCell>
        <TableCell className="text-gray-600">
          {entry.execution_time_ms ? `${entry.execution_time_ms}ms` : "N/A"}
        </TableCell>
        <TableCell className="text-sm text-gray-600">
          {new Date(entry.executed_at).toLocaleString()}
        </TableCell>
        <TableCell>{resultDisplay}</TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{entry.executed_by}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            entry.target_database === "production"
              ? "bg-red-100 text-red-900"
              : "bg-blue-100 text-blue-900"
          }`}
        >
          {entry.target_database}
        </span>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            entry.status === "success"
              ? "bg-green-100 text-green-900"
              : "bg-red-100 text-red-900"
          }`}
        >
          {entry.status}
        </span>
      </TableCell>
      <TableCell className="text-gray-700">
        {entry.rows_affected !== null ? entry.rows_affected : "N/A"}
      </TableCell>
      <TableCell className="text-gray-600">
        {entry.execution_time_ms ? `${entry.execution_time_ms}ms` : "N/A"}
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {new Date(entry.executed_at).toLocaleString()}
      </TableCell>
      <TableCell>
        {resultDisplay || (
          <button
            onClick={() => onOpenDetails(entry)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
          >
            Details
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}
