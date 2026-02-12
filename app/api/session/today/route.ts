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
    .select("id, concept_id, subject_id, difficulty")
    .eq("user_id", user.id)
    .eq("session_date", today)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; concept_id: string | null; subject_id: string | null; difficulty: string | null }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ session: null }, { status: 200 });
  }

  const missingMetadata = !data.concept_id || !data.subject_id || !data.difficulty;
  if (missingMetadata) {
    return NextResponse.json(
      {
        session: {
          sessionId: data.id,
          conceptName: null,
          needsReset: true,
        },
      },
      { status: 200 },
    );
  }

  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("title")
    .eq("id", data.concept_id)
    .maybeSingle<{ title: string }>();

  if (conceptError) {
    return NextResponse.json({ error: conceptError.message }, { status: 500 });
  }

  if (!concept) {
    return NextResponse.json(
      {
        session: {
          sessionId: data.id,
          conceptName: null,
          needsReset: true,
        },
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      session: {
        sessionId: data.id,
        conceptName: concept.title,
        needsReset: false,
      },
    },
    { status: 200 },
  );
}
