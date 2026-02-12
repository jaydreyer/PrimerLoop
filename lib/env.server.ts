import "server-only";

function assertPresent(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function requireAdminApiKey(): string {
  return assertPresent("ADMIN_API_KEY", process.env.ADMIN_API_KEY);
}

export function requireSupabaseServiceRoleKey(): string {
  return assertPresent("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function requireSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return assertPresent("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)", url);
}

export function requireLlmApiKey(): string {
  return assertPresent("LLM_API_KEY", process.env.LLM_API_KEY);
}

// Failsafe: enforce required secrets for production build/runtime.
if (process.env.NODE_ENV === "production") {
  requireSupabaseServiceRoleKey();
  requireAdminApiKey();
  requireLlmApiKey();
}
