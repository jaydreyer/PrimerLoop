import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import type { Difficulty } from "../../../../lib/types";

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
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
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

  // Deterministic temporary concept selection for scaffolded sessions.
  let selectedSubjectId: string | null = null;
  let selectedConcept: { id: string; difficulty: Difficulty } | null = null;

  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("subject_id")
    .eq("user_id", user.id)
    .maybeSingle<{ subject_id: string }>();

  selectedSubjectId = userSettings?.subject_id ?? null;

  if (!selectedSubjectId) {
    const { data: defaultSubject } = await supabase
      .from("subjects")
      .select("id")
      .eq("slug", "ai-llm-systems")
      .maybeSingle<{ id: string }>();
    selectedSubjectId = defaultSubject?.id ?? null;
  }

  if (selectedSubjectId) {
    const { data: firstConcept } = await supabase
      .from("concepts")
      .select("id, difficulty")
      .eq("subject_id", selectedSubjectId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; difficulty: Difficulty }>();
    selectedConcept = firstConcept ?? null;
  }

  if (!selectedSubjectId || !selectedConcept?.id || !selectedConcept.difficulty) {
    return NextResponse.json(
      {
        error:
          "Session metadata missing (subject_id, concept_id, or difficulty). Backfill sessions or seed subjects/concepts before starting sessions.",
      },
      { status: 500 },
    );
  }

  const { data: created, error: createError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      session_date: today,
      status: "active",
      subject_id: selectedSubjectId,
      concept_id: selectedConcept.id,
      difficulty: selectedConcept.difficulty,
    })
    .select("id")
    .single<{ id: string }>();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? "Unable to start session" }, { status: 500 });
  }

  await supabase.from("session_concepts").upsert(
    {
      session_id: created.id,
      concept_id: selectedConcept.id,
      kind: "new",
      question_count: 6,
    },
    { onConflict: "session_id,concept_id" },
  );

  return NextResponse.json({ sessionId: created.id, existing: false }, { status: 200 });
}
