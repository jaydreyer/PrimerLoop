import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resolvedUrl = process.env.SUPABASE_URL ?? url;

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function createSupabaseUserServer() {
  const cookieStore = await cookies();
  const supabaseUrl = requireEnv(
    resolvedUrl,
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
  );
  const supabaseAnonKey = requireEnv(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set(cookie);
          } catch {
            // Route handlers can write cookies; server components may not.
          }
        }
      },
    },
  });
}
