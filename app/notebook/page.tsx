import Link from "next/link";
import { createSupabaseUserServer } from "../../lib/supabaseUserServer";

export default async function NotebookPage() {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <h1>Notebook</h1>
        <p style={{ color: "#9f1d1d" }}>Please sign in to view your notebook.</p>
      </main>
    );
  }

  const { data: masteryRows } = await supabase
    .from("user_concept_mastery")
    .select("concept_id, mastery_score, next_review_at")
    .eq("user_id", user.id);

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("concept_id")
    .eq("user_id", user.id)
    .not("concept_id", "is", null);

  const conceptIds = new Set<string>();
  for (const row of masteryRows ?? []) {
    if (row.concept_id) conceptIds.add(row.concept_id as string);
  }
  for (const row of sessionRows ?? []) {
    if (row.concept_id) conceptIds.add(row.concept_id as string);
  }

  const ids = [...conceptIds];
  const { data: concepts } = ids.length
    ? await supabase.from("concepts").select("id, title").in("id", ids).order("title", { ascending: true })
    : { data: [] as Array<{ id: string; title: string }> };

  const masteryByConcept = new Map(
    (masteryRows ?? []).map((row) => [
      row.concept_id as string,
      {
        masteryScore: Number(row.mastery_score ?? 0),
        nextReviewAt: (row.next_review_at as string | null) ?? null,
      },
    ]),
  );

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>Notebook</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Your concept notes and recall guides.</p>

      {concepts && concepts.length > 0 ? (
        <section style={{ display: "grid", gap: 12 }}>
          {concepts.map((concept) => {
            const mastery = masteryByConcept.get(concept.id);
            return (
              <article
                key={concept.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  background: "#fff",
                }}
              >
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{concept.title}</h2>
                <p style={{ margin: "0 0 4px", color: "#444", fontSize: 14 }}>
                  Mastery: {typeof mastery?.masteryScore === "number" ? mastery.masteryScore.toFixed(2) : "N/A"}
                </p>
                <p style={{ margin: "0 0 12px", color: "#666", fontSize: 14 }}>
                  Next review: {mastery?.nextReviewAt ? new Date(mastery.nextReviewAt).toLocaleDateString() : "N/A"}
                </p>
                <Link
                  href={`/notebook/${concept.id}`}
                  style={{
                    display: "inline-block",
                    textDecoration: "none",
                    background: "#111",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "8px 12px",
                  }}
                >
                  Open note
                </Link>
              </article>
            );
          })}
        </section>
      ) : (
        <p style={{ color: "#555" }}>No notebook concepts yet. Complete a session to generate your first note.</p>
      )}
    </main>
  );
}
