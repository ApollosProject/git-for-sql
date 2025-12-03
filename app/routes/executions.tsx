import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getExecutionHistory } from "~/lib/db.server";
import { getUserFromSession } from "~/lib/auth.server";
import { useState } from "react";
import { DetailsDrawer } from "~/components/DetailsDrawer";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "~/components/Table";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require authentication
  const user = await getUserFromSession(request);
  if (!user) {
    throw redirect("/login");
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const history = await getExecutionHistory(limit);

  return json({ history });
}

export default function Executions() {
  const { history } = useLoaderData<typeof loader>();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = (entry: any) => {
    setSelectedEntry(entry);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedEntry(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Execution History</h2>
        <p className="text-gray-600">
          Complete audit trail of all SQL executions
        </p>
      </div>

      {history.length === 0 ? (
        <div className="card">
          <p className="text-gray-600">No execution history yet</p>
        </div>
      ) : (
        <div className="card">
          <Table>
            <TableHeader>
              <TableHeaderCell>Script</TableHeaderCell>
              <TableHeaderCell>Database</TableHeaderCell>
              <TableHeaderCell>Executed By</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Rows</TableHeaderCell>
              <TableHeaderCell>Time</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableHeader>
            <TableBody>
              {history.map((entry) => {
                const approvers = entry.approvers
                  ? Array.isArray(entry.approvers)
                    ? entry.approvers
                    : JSON.parse(entry.approvers as any)
                  : [];

                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">
                        {entry.script_name}
                      </div>
                      {approvers.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Approved by: {approvers.join(", ")}
                        </div>
                      )}
                    </TableCell>
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
                    <TableCell className="text-gray-700">
                      {entry.executed_by}
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
                      {entry.rows_affected !== null
                        ? entry.rows_affected
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {entry.execution_time_ms
                        ? `${entry.execution_time_ms}ms`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(entry.executed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openDrawer(entry)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                      >
                        Details
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
