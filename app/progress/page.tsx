import { createSupabaseUserServer } from "../../lib/supabaseUserServer";
import { deriveConceptStatuses, type ConceptStatus } from "../../lib/sessionEngine";

type ConceptRow = {
  id: string;
  title: string;
  slug: string;
  created_at: string | null;
};

type PrerequisiteRow = {
  concept_id: string;
  prerequisite_concept_id: string;
};

function statusClasses(status: ConceptStatus): string {
  if (status === "Locked") return "bg-slate-200 text-slate-700";
  if (status === "Available") return "bg-sky-100 text-sky-800";
  if (status === "In Review") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

export default async function ProgressPage() {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Curriculum</h1>
        <p className="text-sm text-rose-700">Please sign in to view curriculum progression.</p>
      </main>
    );
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
    return (
      <main className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Curriculum</h1>
        <p className="text-sm text-slate-600">No subject selected yet.</p>
      </main>
    );
  }

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, title, slug, created_at")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  const conceptRows = (concepts ?? []) as ConceptRow[];
  const conceptIds = conceptRows.map((concept) => concept.id);
  const conceptById = new Map(conceptRows.map((concept) => [concept.id, concept]));

  const { data: prerequisiteRows } = conceptIds.length
    ? await supabase
        .from("concept_prerequisites")
        .select("concept_id, prerequisite_concept_id")
        .in("concept_id", conceptIds)
    : { data: [] as PrerequisiteRow[] };

  const { data: masteryRows } = await supabase
    .from("user_concept_mastery")
    .select("concept_id, mastery_score, next_review_at")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId);

  const prerequisitesByConceptId = new Map<string, string[]>();
  for (const concept of conceptRows) {
    prerequisitesByConceptId.set(concept.id, []);
  }
  for (const row of (prerequisiteRows ?? []) as PrerequisiteRow[]) {
    const current = prerequisitesByConceptId.get(row.concept_id) ?? [];
    current.push(row.prerequisite_concept_id);
    prerequisitesByConceptId.set(row.concept_id, current);
  }

  const statuses = deriveConceptStatuses(
    conceptRows.map((concept) => ({
      id: concept.id,
      title: concept.title,
      track: undefined,
      prerequisiteIds: prerequisitesByConceptId.get(concept.id) ?? [],
      createdAt: concept.created_at,
    })),
    (masteryRows ?? []).map((row) => ({
      conceptId: row.concept_id as string,
      masteryScore: Number(row.mastery_score ?? 0),
      nextReviewAt: (row.next_review_at as string | null) ?? null,
    })),
  );
  const statusByConceptId = new Map(statuses.map((item) => [item.conceptId, item]));

  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Curriculum</h1>
        <p className="text-sm text-slate-600 sm:text-base">Locked, available, and review-ready concepts.</p>
      </header>

      <section className="grid gap-3">
        {conceptRows.map((concept) => {
          const statusItem = statusByConceptId.get(concept.id);
          const status: ConceptStatus = statusItem?.status ?? "Available";
          const prerequisites = statusItem?.prerequisiteIds ?? [];

          const prerequisiteTitles = prerequisites
            .map((id) => conceptById.get(id)?.title ?? id)
            .join(", ");

          return (
            <article key={concept.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{concept.title}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(status)}`}>{status}</span>
              </div>
              <p className="text-xs text-slate-500">{concept.slug}</p>
              {status === "Locked" && prerequisiteTitles ? (
                <p className="mt-2 text-sm text-slate-700">Prereqs: {prerequisiteTitles}</p>
              ) : null}
              {status !== "Locked" ? (
                <p className="mt-2 text-sm text-slate-700">
                  Mastery: {statusItem?.masteryLevel ?? 0} / 4
                  {statusItem?.nextReviewAt
                    ? ` · Next review: ${new Date(statusItem.nextReviewAt).toLocaleDateString()}`
                    : ""}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
