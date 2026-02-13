import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import { deriveConceptStatuses } from "../../../../lib/sessionEngine";
import type { Difficulty } from "../../../../lib/types";

const setConceptBodySchema = z
  .object({
    conceptId: z.string().uuid(),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = setConceptBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { conceptId } = parsed.data;
  const { data: selectedConcept, error: conceptError } = await supabase
    .from("concepts")
    .select("id, subject_id, difficulty")
    .eq("id", conceptId)
    .maybeSingle<{ id: string; subject_id: string; difficulty: Difficulty | null }>();

  if (conceptError) {
    return NextResponse.json({ error: conceptError.message }, { status: 500 });
  }
  if (!selectedConcept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("subject_id")
    .eq("user_id", user.id)
    .maybeSingle<{ subject_id: string }>();

  let selectedSubjectId = userSettings?.subject_id ?? null;
  if (!selectedSubjectId) {
    const { data: firstSubject } = await supabase
      .from("subjects")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    selectedSubjectId = firstSubject?.id ?? null;
  }

  if (!selectedSubjectId || selectedConcept.subject_id !== selectedSubjectId) {
    return NextResponse.json({ error: "Concept does not belong to current subject" }, { status: 400 });
  }

  const { data: subjectConcepts, error: conceptsError } = await supabase
    .from("concepts")
    .select("id, title, track, created_at")
    .eq("subject_id", selectedSubjectId)
    .order("created_at", { ascending: true });

  if (conceptsError) {
    return NextResponse.json({ error: conceptsError.message }, { status: 500 });
  }

  const conceptRows = (subjectConcepts ?? []) as Array<{
    id: string;
    title: string;
    track: string;
    created_at: string | null;
  }>;
  const conceptIds = conceptRows.map((concept) => concept.id);

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
  for (const subjectConceptId of conceptIds) {
    prerequisitesByConceptId.set(subjectConceptId, []);
  }
  for (const row of (prerequisiteRows ?? []) as Array<{ concept_id: string; prerequisite_concept_id: string }>) {
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

  const statuses = deriveConceptStatuses(
    conceptRows.map((concept) => ({
      id: concept.id,
      title: concept.title,
      track: concept.track,
      prerequisiteIds: prerequisitesByConceptId.get(concept.id) ?? [],
      createdAt: concept.created_at,
    })),
    (masteryRows ?? []).map((row) => ({
      conceptId: row.concept_id as string,
      masteryScore: Number(row.mastery_score ?? 0),
      nextReviewAt: (row.next_review_at as string | null) ?? null,
    })),
  );
  const selectedStatus = statuses.find((status) => status.conceptId === conceptId);
  if (!selectedStatus || (!selectedStatus.unlocked && !selectedStatus.mastered)) {
    return NextResponse.json({ error: "Concept is locked" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: existingSession, error: existingError } = await supabase
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

  const difficulty: Difficulty = selectedConcept.difficulty ?? "beginner";
  let sessionId: string | null = null;

  if (existingSession) {
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        subject_id: selectedSubjectId,
        concept_id: conceptId,
        difficulty,
      })
      .eq("id", existingSession.id)
      .eq("user_id", user.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    sessionId = existingSession.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        session_date: today,
        status: "active",
        subject_id: selectedSubjectId,
        concept_id: conceptId,
        difficulty,
      })
      .select("id")
      .single<{ id: string }>();
    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? "Unable to create session" }, { status: 500 });
    }
    sessionId = created.id;
  }

  if (!sessionId) {
    return NextResponse.json({ error: "Unable to set concept for session" }, { status: 500 });
  }

  await supabase.from("session_concepts").upsert(
    {
      session_id: sessionId,
      concept_id: conceptId,
      kind: selectedStatus.status === "In Review" ? "review" : "new",
      question_count: 6,
    },
    { onConflict: "session_id,concept_id" },
  );

  return NextResponse.json({ sessionId }, { status: 200 });
}
