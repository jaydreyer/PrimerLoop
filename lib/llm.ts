import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Difficulty } from "./types";
import { PROMPT_FILES } from "./prompts";
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

export const LessonContentSchema = z.object({
  title: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  key_takeaways: z.array(z.string().min(1)).min(1),
});

export type LessonContent = z.infer<typeof LessonContentSchema>;

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

type GenerateLessonInput = {
  conceptName: string;
  difficulty: Difficulty;
  subjectName: string;
};

function fallbackLessonContent(input: GenerateLessonInput): LessonContent {
  const title = `${input.conceptName} (${input.difficulty})`;
  return {
    title,
    sections: [
      {
        heading: "Core Idea",
        bullets: [
          `${input.conceptName} is part of the ${input.subjectName} learning track.`,
          "Focus on understanding purpose, constraints, and practical usage.",
        ],
      },
      {
        heading: "How To Apply",
        bullets: [
          "Break the concept into one or two concrete implementation steps.",
          "Relate it to a recent problem you solved or system you designed.",
        ],
      },
    ],
    key_takeaways: [
      `${input.conceptName} should be explained in clear, concise terms.`,
      "You should connect this concept to real system decisions.",
    ],
  };
}

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function generateLessonContent(input: GenerateLessonInput): Promise<LessonContent> {
  const llmApiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "gpt-4.1-mini";
  const promptPath = path.join(process.cwd(), PROMPT_FILES.lesson);
  const promptTemplate = await readFile(promptPath, "utf-8");

  if (!llmApiKey) {
    return fallbackLessonContent(input);
  }

  const instruction = [
    promptTemplate,
    "",
    "Return strict JSON only with this exact shape:",
    '{ "title": string, "sections": [{ "heading": string, "bullets": string[] }], "key_takeaways": string[] }',
    `Concept: ${input.conceptName}`,
    `Difficulty: ${input.difficulty}`,
    `Subject: ${input.subjectName}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llmApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: instruction,
      }),
    });

    if (!response.ok) {
      return fallbackLessonContent(input);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const outputText =
      payload.output_text ??
      payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("\n") ??
      "";

    const parsed = parseJsonObject(outputText);
    const validated = LessonContentSchema.safeParse(parsed);
    if (!validated.success) {
      return fallbackLessonContent(input);
    }

    return validated.data;
  } catch {
    return fallbackLessonContent(input);
  }
}
