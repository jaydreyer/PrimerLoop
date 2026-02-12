import "server-only";

import type { Difficulty } from "./types";
import { createSupabaseUserServer } from "./supabaseUserServer";

export type GeneratedAssetType = "lesson" | "quiz" | "notebook_template";

export type LessonCacheKey = {
  subjectId: string;
  conceptId: string;
  difficulty: Difficulty;
  version: number;
};

export type QuizCacheKey = {
  subjectId: string;
  conceptId: string;
  difficulty: Difficulty;
  version: number;
};

export type NotebookTemplateCacheKey = {
  subjectId: string;
  version: number;
};

export function lessonCacheKey(input: LessonCacheKey): string {
  return `lesson:${input.subjectId}:${input.conceptId}:${input.difficulty}:v${input.version}`;
}

export function quizCacheKey(input: QuizCacheKey): string {
  return `quiz:${input.subjectId}:${input.conceptId}:${input.difficulty}:v${input.version}`;
}

export function notebookTemplateCacheKey(input: NotebookTemplateCacheKey): string {
  return `notebook_template:${input.subjectId}:v${input.version}`;
}

export function shouldUseLlmGrader(questionType: string): boolean {
  return questionType === "short_answer";
}

type CachedAssetRecord = {
  content: unknown;
};

export async function getCachedLesson(
  subjectId: string,
  conceptId: string,
  difficulty: Difficulty,
  version: number,
) {
  const supabase = await createSupabaseUserServer();
  const { data, error } = await supabase
    .from("generated_assets")
    .select("content")
    .eq("asset_type", "lesson")
    .eq("subject_id", subjectId)
    .eq("concept_id", conceptId)
    .eq("difficulty", difficulty)
    .eq("version", version)
    .maybeSingle<CachedAssetRecord>();

  if (error) {
    throw new Error(`Failed reading cached lesson: ${error.message}`);
  }

  return data?.content ?? null;
}

export async function getCachedQuiz(
  subjectId: string,
  conceptId: string,
  difficulty: Difficulty,
  version: number,
) {
  const supabase = await createSupabaseUserServer();
  const { data, error } = await supabase
    .from("generated_assets")
    .select("content")
    .eq("asset_type", "quiz")
    .eq("subject_id", subjectId)
    .eq("concept_id", conceptId)
    .eq("difficulty", difficulty)
    .eq("version", version)
    .maybeSingle<CachedAssetRecord>();

  if (error) {
    throw new Error(`Failed reading cached quiz: ${error.message}`);
  }

  return data?.content ?? null;
}
