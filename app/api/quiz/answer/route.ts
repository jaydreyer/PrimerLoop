import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";

const quizAnswerBodySchema = z
  .object({
    sessionId: z.string().min(1),
    questionId: z.string().min(1),
    answer: z.unknown(),
    questionType: z.string().optional(),
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

  const parsed = quizAnswerBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
