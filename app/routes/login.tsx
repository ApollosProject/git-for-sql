import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Form, useSearchParams } from "react-router";
import { getUserFromSession } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // If already logged in, redirect to dashboard
  const user = await getUserFromSession(request);
  if (user) {
    return redirect("/");
  }
  return null;
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <>
      <style>{`
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          background-attachment: fixed !important;
        }
        header {
          display: none !important;
        }
        main {
          padding: 0 !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
      `}</style>
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-8 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-900">Git for SQL</h1>
          </div>

          {error && (
            <div className="p-4 bg-error-50 border border-error-300 rounded-md mb-4 text-error-800 text-sm">
              Authentication failed. Please try again.
            </div>
          )}

          <Form method="get" action="/auth/github">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 text-base px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="inline-block"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Sign in with GitHub
            </button>
          </Form>
        </div>
      </div>
    </>
  );
}
