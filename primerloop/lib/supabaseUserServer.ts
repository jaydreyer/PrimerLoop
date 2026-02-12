import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resolvedUrl = process.env.SUPABASE_URL ?? url;

if (!resolvedUrl || !anonKey) {
  throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export async function createSupabaseUserServer() {
  const cookieStore = await cookies();

  return createServerClient(resolvedUrl, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Ignore cookie writes from server components without response context.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // Ignore cookie writes from server components without response context.
        }
      },
    },
  });
}
