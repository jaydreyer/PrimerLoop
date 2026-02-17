import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";

const sessionCompleteBodySchema = z
  .object({
    sessionId: z.string().uuid().optional(),
  })
  .strict();

type SessionStatus = "active" | "completed" | "abandoned";

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

  const parsed = sessionCompleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const requestedSessionId = parsed.data.sessionId ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const sessionQuery = supabase
    .from("sessions")
    .select("id, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: session, error: sessionError } = requestedSessionId
    ? await sessionQuery.eq("id", requestedSessionId).maybeSingle<{ id: string; status: SessionStatus }>()
    : await sessionQuery.eq("session_date", today).eq("status", "active").maybeSingle<{ id: string; status: SessionStatus }>();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "No active session found to complete" }, { status: 404 });
  }

  if (session.status === "completed") {
    return NextResponse.json({ sessionId: session.id, status: "completed", alreadyCompleted: true }, { status: 200 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ error: `Cannot complete session in status '${session.status}'` }, { status: 400 });
  }

  const { data: submission, error: submissionError } = await supabase
    .from("quiz_submissions")
    .select("id")
    .eq("session_id", session.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }

  if (!submission) {
    return NextResponse.json({ error: "Cannot complete session before quiz submission" }, { status: 400 });
  }

  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", session.id)
    .eq("user_id", user.id)
    .eq("status", "active");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      sessionId: session.id,
      status: "completed",
      completedAt,
    },
    { status: 200 },
  );
}
