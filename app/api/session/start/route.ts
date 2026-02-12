import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";

const sessionStartBodySchema = z
  .object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const parsed = sessionStartBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const today = parsed.data.sessionDate ?? new Date().toISOString().slice(0, 10);

  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("session_date", today)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ sessionId: existing.id, existing: true }, { status: 200 });
  }

  const { data: created, error: createError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      session_date: today,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? "Unable to start session" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: created.id, existing: false }, { status: 200 });
}
