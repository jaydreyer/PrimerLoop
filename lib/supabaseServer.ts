import { createSupabaseUserServer } from "./supabaseUserServer";

// Keep this export user-scoped by default for route handlers.
export const supabaseServer = createSupabaseUserServer;
