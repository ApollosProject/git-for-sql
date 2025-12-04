import { PassThrough } from "node:stream";
import type { EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { renderToPipeableStream } from "react-dom/server";
import { initializeSchema, testConnections } from "./lib/db.server";
import { validateConfig } from "./config.server";

const ABORT_DELAY = 5_000;

// Suppress console errors for harmless browser requests (.well-known, favicon)
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || "";
  // Only suppress route matching errors for .well-known and favicon paths
  if (message.includes("No route matches URL")) {
    const urlMatch = message.match(/No route matches URL "([^"]+)"/);
    if (urlMatch) {
      const url = urlMatch[1];
      if (
        url.startsWith("/.well-known/") ||
        url === "/favicon.ico" ||
        url === "/favicon"
      ) {
        return; // Suppress this specific error
      }
    }
  }
  // Pass through all other errors
  originalConsoleError.apply(console, args);
};

// Initialize database on server start
validateConfig();
initializeSchema().then(() => testConnections());

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // Handle .well-known and favicon requests - return 404 silently
  // This must happen BEFORE React Router processes the request to prevent error logging
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (
    pathname.startsWith("/.well-known/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon"
  ) {
    // Return 404 without going through React Router to prevent error logging
    return new Response(null, { status: 404 });
  }

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={remixContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Suppress errors for .well-known and favicon requests
          const url = new URL(request.url);
          const pathname = url.pathname;
          if (
            pathname.startsWith("/.well-known/") ||
            pathname === "/favicon.ico" ||
            pathname === "/favicon"
          ) {
            return; // Don't log these errors
          }
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
