import { NextResponse } from "next/server";
import { isAdminRouteRequest } from "../../../../../../lib/adminRouteAuth";
import { putCachedLesson } from "../../../../../../lib/generatedAssetsAdmin";
import type { Difficulty } from "../../../../../../lib/types";

type LessonCacheBody = {
  subjectId: string;
  conceptId: string;
  difficulty: Difficulty;
  version: number;
  content: unknown;
};

export async function POST(request: Request) {
  if (!isAdminRouteRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<LessonCacheBody>;

  if (
    !body.subjectId ||
    !body.conceptId ||
    !body.difficulty ||
    typeof body.version !== "number" ||
    body.version <= 0 ||
    typeof body.content === "undefined"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await putCachedLesson(body.subjectId, body.conceptId, body.difficulty, body.version, body.content);

  return NextResponse.json({ ok: true });
}
