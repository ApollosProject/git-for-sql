/**
 * JSON response helper for React Router v7 compatibility
 * In v7, use Response.json() directly, but this helper maintains compatibility
 */
export function json<Data = unknown>(
  data: Data,
  init?: ResponseInit | number
): Response {
  if (typeof init === "number") {
    return Response.json(data, { status: init });
  }
  return Response.json(data, init);
}
