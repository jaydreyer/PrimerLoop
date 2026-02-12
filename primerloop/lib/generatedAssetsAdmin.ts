import "server-only";

import type { Difficulty } from "./types";
import { supabaseAdmin } from "./supabaseAdmin";

export async function putCachedLesson(
  subjectId: string,
  conceptId: string,
  difficulty: Difficulty,
  version: number,
  content: unknown,
) {
  const { error } = await supabaseAdmin.from("generated_assets").upsert(
    {
      asset_type: "lesson",
      subject_id: subjectId,
      concept_id: conceptId,
      difficulty,
      version,
      content,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "asset_type,subject_id,concept_id,difficulty,version",
    },
  );

  if (error) {
    throw new Error(`Failed writing cached lesson: ${error.message}`);
  }
}

export async function putCachedQuiz(
  subjectId: string,
  conceptId: string,
  difficulty: Difficulty,
  version: number,
  content: unknown,
) {
  const { error } = await supabaseAdmin.from("generated_assets").upsert(
    {
      asset_type: "quiz",
      subject_id: subjectId,
      concept_id: conceptId,
      difficulty,
      version,
      content,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "asset_type,subject_id,concept_id,difficulty,version",
    },
  );

  if (error) {
    throw new Error(`Failed writing cached quiz: ${error.message}`);
  }
}
