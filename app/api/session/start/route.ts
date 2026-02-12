import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import type { Difficulty } from "../../../../lib/types";
import { chooseUnlockedConceptForToday } from "../../../../lib/sessionEngine";

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

  let selectedSubjectId: string | null = null;

  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("subject_id")
    .eq("user_id", user.id)
    .maybeSingle<{ subject_id: string }>();

  selectedSubjectId = userSettings?.subject_id ?? null;

  if (!selectedSubjectId) {
    const { data: firstSubject } = await supabase
      .from("subjects")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    selectedSubjectId = firstSubject?.id ?? null;
  }

  if (!selectedSubjectId) {
    return NextResponse.json(
      {
        error:
          "Session metadata missing (subject_id, concept_id, or difficulty). Backfill sessions or seed subjects/concepts before starting sessions.",
      },
      { status: 500 },
    );
  }

  const now = new Date();

  const { data: allConcepts, error: conceptsError } = await supabase
    .from("concepts")
    .select("id, difficulty, created_at")
    .eq("subject_id", selectedSubjectId)
    .order("created_at", { ascending: true });

  if (conceptsError) {
    return NextResponse.json({ error: conceptsError.message }, { status: 500 });
  }

  const concepts = (allConcepts ?? []) as Array<{
    id: string;
    difficulty: Difficulty | null;
    created_at: string | null;
  }>;
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));

  const conceptIds = concepts.map((concept) => concept.id);
  const { data: prerequisiteRows, error: prerequisitesError } = conceptIds.length
    ? await supabase
        .from("concept_prerequisites")
        .select("concept_id, prerequisite_concept_id")
        .in("concept_id", conceptIds)
    : { data: [], error: null };

  if (prerequisitesError) {
    return NextResponse.json({ error: prerequisitesError.message }, { status: 500 });
  }

  const prerequisitesByConceptId = new Map<string, string[]>();
  for (const conceptId of conceptIds) {
    prerequisitesByConceptId.set(conceptId, []);
  }
  for (const row of (prerequisiteRows ?? []) as Array<{
    concept_id: string;
    prerequisite_concept_id: string;
  }>) {
    const existing = prerequisitesByConceptId.get(row.concept_id) ?? [];
    existing.push(row.prerequisite_concept_id);
    prerequisitesByConceptId.set(row.concept_id, existing);
  }

  const { data: masteryRows, error: masteryError } = await supabase
    .from("user_concept_mastery")
    .select("concept_id, mastery_score, next_review_at")
    .eq("user_id", user.id)
    .eq("subject_id", selectedSubjectId);

  if (masteryError) {
    return NextResponse.json({ error: masteryError.message }, { status: 500 });
  }

  const mastery = (masteryRows ?? []) as Array<{
    concept_id: string;
    mastery_score: number;
    next_review_at: string | null;
  }>;
  const selection = chooseUnlockedConceptForToday(
    concepts.map((concept) => ({
      id: concept.id,
      createdAt: concept.created_at,
      prerequisiteIds: prerequisitesByConceptId.get(concept.id) ?? [],
    })),
    mastery.map((row) => ({
      conceptId: row.concept_id,
      masteryScore: row.mastery_score,
      nextReviewAt: row.next_review_at,
    })),
    now,
  );

  if (!selection) {
    return NextResponse.json(
      {
        error:
          "Session metadata missing (subject_id, concept_id, or difficulty). Backfill sessions or seed subjects/concepts before starting sessions.",
      },
      { status: 500 },
    );
  }

  const selectedConcept = conceptById.get(selection.conceptId);
  if (!selectedConcept) {
    return NextResponse.json({ error: "Selected concept not found" }, { status: 500 });
  }

  const selectedDifficulty: Difficulty = selectedConcept.difficulty ?? "beginner";

  const { data: created, error: createError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      session_date: today,
      status: "active",
      subject_id: selectedSubjectId,
      concept_id: selectedConcept.id,
      difficulty: selectedDifficulty,
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
      kind: selection.source === "new_concept" ? "new" : "review",
      question_count: 6,
    },
    { onConflict: "session_id,concept_id" },
  );

  return NextResponse.json({ sessionId: created.id, existing: false }, { status: 200 });
}
