import { NextResponse } from "next/server";
import {
  generateLessonContent,
  generateNotebookEntryContent,
  getCachedLesson,
  LessonContentSchema,
} from "../../../../lib/llm";
import { NotebookEntrySchema } from "../../../../lib/notebook";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import type { Difficulty } from "../../../../lib/types";

type RouteParams = {
  params: Promise<{ conceptId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conceptId } = await params;
  const version = 1;

  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("id, title, subject_id, difficulty")
    .eq("id", conceptId)
    .maybeSingle<{ id: string; title: string; subject_id: string; difficulty: Difficulty | null }>();

  if (conceptError) {
    return NextResponse.json({ error: conceptError.message }, { status: 500 });
  }

  if (!concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const { data: existingEntry, error: existingEntryError } = await supabase
    .from("user_notebook_entries")
    .select("content")
    .eq("user_id", user.id)
    .eq("subject_id", concept.subject_id)
    .eq("concept_id", conceptId)
    .eq("version", version)
    .maybeSingle<{ content: unknown }>();

  if (existingEntryError) {
    return NextResponse.json({ error: existingEntryError.message }, { status: 500 });
  }

  if (existingEntry) {
    const parsed = NotebookEntrySchema.safeParse(existingEntry.content);
    if (!parsed.success) {
      return NextResponse.json({ error: "Stored notebook entry is invalid" }, { status: 500 });
    }
    return NextResponse.json({ conceptId, entry: parsed.data, cached: true }, { status: 200 });
  }

  const difficulty: Difficulty = concept.difficulty ?? "beginner";

  const lessonContent = await getCachedLesson(concept.subject_id, concept.id, difficulty, 1);
  let parsedLesson = LessonContentSchema.safeParse(lessonContent);

  if (!parsedLesson.success) {
    const { data: subject } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", concept.subject_id)
      .maybeSingle<{ name: string }>();

    const generatedLesson = await generateLessonContent({
      conceptName: concept.title,
      difficulty,
      subjectName: subject?.name ?? "Current Subject",
    });
    parsedLesson = LessonContentSchema.safeParse(generatedLesson);
  }

  if (!parsedLesson.success) {
    return NextResponse.json({ error: "Lesson unavailable for notebook generation" }, { status: 500 });
  }

  const { data: latestQuiz } = await supabase
    .from("quiz_submissions")
    .select("percent, results, created_at")
    .eq("user_id", user.id)
    .eq("concept_id", concept.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ percent: number; results: unknown; created_at: string }>();

  const notebookEntry = await generateNotebookEntryContent({
    conceptTitle: concept.title,
    lesson: parsedLesson.data,
    quizResults: latestQuiz ?? null,
  });
  const parsedNotebookEntry = NotebookEntrySchema.safeParse(notebookEntry);

  if (!parsedNotebookEntry.success) {
    return NextResponse.json({ error: "Generated notebook entry is invalid" }, { status: 500 });
  }

  const { error: upsertError } = await supabase.from("user_notebook_entries").upsert(
    {
      user_id: user.id,
      subject_id: concept.subject_id,
      concept_id: concept.id,
      version,
      content: parsedNotebookEntry.data,
    },
    { onConflict: "user_id,concept_id,version" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      conceptId: concept.id,
      entry: parsedNotebookEntry.data,
      cached: false,
    },
    { status: 200 },
  );
}
