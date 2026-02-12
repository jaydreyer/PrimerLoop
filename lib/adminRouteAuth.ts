import "server-only";

export function isAdminRouteRequest(request: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const provided = request.headers.get("x-admin-api-key");
  return provided === expected;
}
