import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../lib/supabaseUserServer";

const settingsBodySchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    subjectSlug: z.string().min(1).optional(),
    dailyMinutes: z.number().int().min(10).max(15).optional(),
  })
  .strict();

export async function GET() {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("subject_id, daily_minutes")
    .eq("user_id", user.id)
    .maybeSingle<{ subject_id: string; daily_minutes: number }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      settings: data
        ? {
            subjectId: data.subject_id,
            dailyMinutes: data.daily_minutes,
          }
        : null,
    },
    { status: 200 },
  );
}

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

  const parsed = settingsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subjectId, subjectSlug, dailyMinutes } = parsed.data;
  let resolvedSubjectId = subjectId ?? null;

  if (!resolvedSubjectId && subjectSlug) {
    const { data: subjectBySlug, error: slugError } = await supabase
      .from("subjects")
      .select("id")
      .eq("slug", subjectSlug)
      .maybeSingle<{ id: string }>();
    if (slugError) {
      return NextResponse.json({ error: slugError.message }, { status: 500 });
    }
    resolvedSubjectId = subjectBySlug?.id ?? null;
  }

  if (!resolvedSubjectId) {
    const { data: firstSubject, error: firstSubjectError } = await supabase
      .from("subjects")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (firstSubjectError) {
      return NextResponse.json({ error: firstSubjectError.message }, { status: 500 });
    }
    resolvedSubjectId = firstSubject?.id ?? null;
  }

  if (!resolvedSubjectId) {
    return NextResponse.json({ error: "No subjects available" }, { status: 500 });
  }

  const minutes = dailyMinutes ?? 15;
  const nowIso = new Date().toISOString();
  const { error: upsertError } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      subject_id: resolvedSubjectId,
      daily_minutes: minutes,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      settings: {
        subjectId: resolvedSubjectId,
        dailyMinutes: minutes,
      },
    },
    { status: 200 },
  );
}
