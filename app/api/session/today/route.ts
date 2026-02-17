import { NextResponse } from "next/server";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import { deriveConceptStatuses, type ConceptStatus } from "../../../../lib/sessionEngine";

type TodayConcept = {
  id: string;
  title: string;
  track: string;
  created_at: string | null;
};

type TodaySessionPayload = {
  sessionId: string;
  conceptId: string | null;
  conceptName: string | null;
  track: string | null;
  status: ConceptStatus | null;
  masteryLevel: number;
  needsReset: boolean;
};

export async function GET() {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("subject_id")
    .eq("user_id", user.id)
    .maybeSingle<{ subject_id: string }>();

  let subjectId = userSettings?.subject_id ?? null;
  if (!subjectId) {
    const { data: firstSubject } = await supabase
      .from("subjects")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    subjectId = firstSubject?.id ?? null;
  }

  if (!subjectId) {
    return NextResponse.json(
      {
        session: null,
        concepts: [],
        snapshot: { streak: null, sessionsCompleted: 0, avgMastery: null },
      },
      { status: 200 },
    );
  }

  const { data: concepts, error: conceptsError } = await supabase
    .from("concepts")
    .select("id, title, track, created_at")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  if (conceptsError) {
    return NextResponse.json({ error: conceptsError.message }, { status: 500 });
  }

  const conceptRows = (concepts ?? []) as TodayConcept[];
  const conceptIds = conceptRows.map((concept) => concept.id);
  const conceptById = new Map(conceptRows.map((concept) => [concept.id, concept]));

  const { data: prerequisiteRows, error: prerequisiteError } = conceptIds.length
    ? await supabase
        .from("concept_prerequisites")
        .select("concept_id, prerequisite_concept_id")
        .in("concept_id", conceptIds)
    : { data: [], error: null };

  if (prerequisiteError) {
    return NextResponse.json({ error: prerequisiteError.message }, { status: 500 });
  }

  const prerequisitesByConceptId = new Map<string, string[]>();
  for (const conceptId of conceptIds) {
    prerequisitesByConceptId.set(conceptId, []);
  }
  for (const row of (prerequisiteRows ?? []) as Array<{ concept_id: string; prerequisite_concept_id: string }>) {
    const current = prerequisitesByConceptId.get(row.concept_id) ?? [];
    current.push(row.prerequisite_concept_id);
    prerequisitesByConceptId.set(row.concept_id, current);
  }

  const { data: masteryRows, error: masteryError } = await supabase
    .from("user_concept_mastery")
    .select("concept_id, mastery_score, next_review_at")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId);

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
  const statusByConceptId = new Map(statuses.map((status) => [status.conceptId, status]));

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

  const { count: sessionsCompleted } = await supabase
    .from("sessions")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id)
    .eq("status", "completed");

  const avgMastery =
    statuses.length > 0
      ? Number((statuses.reduce((sum, item) => sum + item.masteryLevel, 0) / statuses.length).toFixed(2))
      : null;

  let session: TodaySessionPayload | null = null;
  if (data) {
    if (!data.concept_id || !data.subject_id || !data.difficulty) {
      session = {
        sessionId: data.id,
        conceptId: data.concept_id,
        conceptName: null,
        track: null,
        status: null,
        masteryLevel: 0,
        needsReset: true,
      };
    } else {
      const conceptId = data.concept_id;
      const concept = conceptById.get(conceptId);
      const conceptStatus = statusByConceptId.get(conceptId);
      session = {
        sessionId: data.id,
        conceptId,
        conceptName: concept?.title ?? null,
        track: concept?.track ?? null,
        status: conceptStatus?.status ?? null,
        masteryLevel: conceptStatus?.masteryLevel ?? 0,
        needsReset: !concept,
      };
    }
  }

  return NextResponse.json(
    {
      session,
      concepts: statuses.map((status) => ({
        conceptId: status.conceptId,
        title: status.title ?? "Concept",
        track: status.track ?? "FOUNDATIONS",
        status: status.status,
        masteryLevel: status.masteryLevel,
        unlocked: status.unlocked,
        mastered: status.mastered,
        prerequisiteTitles: status.prerequisiteIds.map(
          (prerequisiteId) => conceptById.get(prerequisiteId)?.title ?? prerequisiteId,
        ),
      })),
      snapshot: {
        streak: null,
        sessionsCompleted: sessionsCompleted ?? 0,
        avgMastery,
      },
    },
    { status: 200 },
  );
}
