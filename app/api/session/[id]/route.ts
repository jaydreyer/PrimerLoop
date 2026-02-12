import { NextResponse } from "next/server";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";
import {
  generateLessonContent,
  getCachedLesson,
  LessonContentSchema,
  type LessonContent,
} from "../../../../lib/llm";
import { requireAdminApiKey } from "../../../../lib/env.server";
import type { SessionRow } from "../../../../lib/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, user_id, subject_id, concept_id, difficulty")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<SessionRow>();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.subject_id || !session.concept_id || !session.difficulty) {
    return NextResponse.json(
      {
        error:
          "Session metadata missing (subject_id, concept_id, or difficulty). Backfill sessions or seed subjects/concepts before loading lessons.",
      },
      { status: 500 },
    );
  }

  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("id, title, slug")
    .eq("id", session.concept_id)
    .maybeSingle<{ id: string; title: string; slug: string }>();

  if (conceptError || !concept) {
    return NextResponse.json({ error: conceptError?.message ?? "Concept not found" }, { status: 500 });
  }

  const subjectId = session.subject_id;
  const difficulty = session.difficulty;
  const lessonVersion = 1;
  const { data: subject } = await supabase
    .from("subjects")
    .select("name")
    .eq("id", subjectId)
    .maybeSingle<{ name: string }>();

  let lesson: LessonContent | null = null;
  const cached = await getCachedLesson(subjectId, concept.id, difficulty, lessonVersion);
  if (cached) {
    const cachedLesson = LessonContentSchema.safeParse(cached);
    if (cachedLesson.success) {
      lesson = cachedLesson.data;
    }
  }

  if (lesson) {
    return NextResponse.json(
      {
        sessionId: session.id,
        concept: { id: concept.id, name: concept.title },
        lesson,
        cached: true,
      },
      { status: 200 },
    );
  }

  const generatedLesson = await generateLessonContent({
    conceptName: concept.title,
    conceptSlug: concept.slug,
    difficulty,
    subjectName: subject?.name ?? "Current Subject",
  });

  const validatedGenerated = LessonContentSchema.safeParse(generatedLesson);
  if (!validatedGenerated.success) {
    return NextResponse.json({ error: "Generated lesson did not match schema" }, { status: 500 });
  }

  const adminApiKey = requireAdminApiKey();
  const cacheWriteResponse = await fetch(new URL("/api/admin/cache/lesson", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": adminApiKey,
    },
    body: JSON.stringify({
      subjectId,
      conceptId: concept.id,
      difficulty,
      version: lessonVersion,
      content: validatedGenerated.data,
    }),
    cache: "no-store",
  });

  if (!cacheWriteResponse.ok) {
    const errorText = await cacheWriteResponse.text();
    return NextResponse.json(
      { error: `Failed to store lesson cache: ${errorText || cacheWriteResponse.statusText}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      sessionId: session.id,
      concept: { id: concept.id, name: concept.title },
      lesson: validatedGenerated.data,
      cached: false,
    },
    { status: 200 },
  );
}
