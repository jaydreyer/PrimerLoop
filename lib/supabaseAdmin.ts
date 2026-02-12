import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServiceRoleKey, requireSupabaseUrl } from "./env.server";

const url = requireSupabaseUrl();
const serviceRoleKey = requireSupabaseServiceRoleKey();

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
