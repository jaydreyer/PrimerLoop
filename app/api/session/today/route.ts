import { NextResponse } from "next/server";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";

export async function GET() {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("session_date", today)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ session: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      session: {
        sessionId: data.id,
        conceptName: null,
      },
    },
    { status: 200 },
  );
}
