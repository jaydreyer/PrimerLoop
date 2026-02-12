import "server-only";
import { requireAdminApiKey } from "./env.server";

export function isAdminRouteRequest(request: Request): boolean {
  const expected = requireAdminApiKey();
  const provided = request.headers.get("x-admin-api-key");
  return provided === expected;
}
