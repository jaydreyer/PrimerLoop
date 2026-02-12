import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Difficulty } from "./types";
import { PROMPT_FILES } from "./prompts";
import { createSupabaseUserServer } from "./supabaseUserServer";
import { requireLlmApiKey } from "./env.server";

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

const QuizQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["mcq", "short"]),
    prompt: z.string().min(1),
    choices: z.array(z.string().min(1)).optional(),
    correctIndex: z.number().int().nonnegative().optional(),
    answer: z.string().min(1).optional(),
    rubric: z.string().min(1).optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "mcq" && (!question.choices || question.choices.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MCQ questions require at least two choices",
        path: ["choices"],
      });
    }
    if (
      question.type === "mcq" &&
      typeof question.correctIndex === "number" &&
      question.choices &&
      question.correctIndex >= question.choices.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctIndex is out of range for choices",
        path: ["correctIndex"],
      });
    }
    if (question.type === "short" && !question.rubric) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Short questions require a rubric",
        path: ["rubric"],
      });
    }
  });

export const QuizContentSchema = z.object({
  title: z.string().min(1),
  questions: z.array(QuizQuestionSchema).min(1),
});

export type QuizContent = z.infer<typeof QuizContentSchema>;

export const ShortGradeSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});

export type ShortGrade = z.infer<typeof ShortGradeSchema>;

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

type GenerateQuizInput = {
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

function fallbackQuizContent(input: GenerateQuizInput): QuizContent {
  return {
    title: `${input.conceptName} Quiz`,
    questions: [
      {
        id: "q1",
        type: "mcq",
        prompt: `Which statement best describes ${input.conceptName}?`,
        choices: [
          `A core concept in ${input.subjectName}`,
          "An unrelated UI framework",
          "A database backup command",
          "A browser extension store",
        ],
        answer: `A core concept in ${input.subjectName}`,
      },
      {
        id: "q2",
        type: "short",
        prompt: `In 2-3 sentences, explain why ${input.conceptName} matters in practice.`,
        rubric: "Mentions real use-case, tradeoff, or implementation concern.",
      },
    ],
  };
}

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export async function generateLessonContent(input: GenerateLessonInput): Promise<LessonContent> {
  let llmApiKey: string;
  try {
    llmApiKey = requireLlmApiKey();
  } catch {
    return fallbackLessonContent(input);
  }
  const model = process.env.LLM_MODEL ?? "gpt-4.1-mini";
  const promptPath = path.join(process.cwd(), PROMPT_FILES.lesson);
  const promptTemplate = await readFile(promptPath, "utf-8");

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

export async function generateQuizContent(input: GenerateQuizInput): Promise<QuizContent> {
  let llmApiKey: string;
  try {
    llmApiKey = requireLlmApiKey();
  } catch {
    return fallbackQuizContent(input);
  }
  const model = process.env.LLM_MODEL ?? "gpt-4.1-mini";
  const promptPath = path.join(process.cwd(), PROMPT_FILES.quiz);
  const promptTemplate = await readFile(promptPath, "utf-8");

  const instruction = [
    promptTemplate,
    "",
    "Return strict JSON only with this exact shape:",
    '{ "title": string, "questions": [{ "id": string, "type": "mcq" | "short", "prompt": string, "choices"?: string[], "answer"?: string, "rubric"?: string }] }',
    `Concept: ${input.conceptName}`,
    `Difficulty: ${input.difficulty}`,
    `Subject: ${input.subjectName}`,
    "Generate 6 questions total, mostly mcq with 1 short question.",
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
      return fallbackQuizContent(input);
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
    const validated = QuizContentSchema.safeParse(parsed);
    if (!validated.success) {
      return fallbackQuizContent(input);
    }

    return validated.data;
  } catch {
    return fallbackQuizContent(input);
  }
}

type GradeShortInput = {
  conceptTitle: string;
  questionPrompt: string;
  rubric: string;
  userAnswer: string;
};

type ShortGradeFailureCode =
  | "missing_api_key"
  | "provider_401"
  | "provider_429"
  | "bad_json"
  | "unknown";

type ShortGradeFailureLog = {
  code: ShortGradeFailureCode;
  message: string;
  name: string;
  status?: number;
  responseBody?: string;
};

function truncateForLog(value: string, max = 500): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function logShortGradeFailure(details: ShortGradeFailureLog): void {
  console.error(
    `[quiz_short_grade_error] ${JSON.stringify({
      code: details.code,
      message: details.message,
      name: details.name,
      status: details.status ?? null,
      responseBody: details.responseBody ?? null,
    })}`,
  );
}

function shortGradeFallback(code: ShortGradeFailureCode): ShortGrade {
  return {
    score: 0.5,
    feedback: "Short answer captured. Marked for review.",
    strengths: [],
    gaps: [`LLM grading failed: ${code}`],
  };
}

export async function gradeShortAnswer(input: GradeShortInput): Promise<ShortGrade> {
  let llmApiKey: string;
  try {
    llmApiKey = requireLlmApiKey();
  } catch {
    logShortGradeFailure({
      code: "missing_api_key",
      message: "LLM_API_KEY is not configured",
      name: "MissingApiKeyError",
    });
    return shortGradeFallback("missing_api_key");
  }
  const model = process.env.LLM_MODEL ?? "gpt-4.1-mini";
  const promptPath = path.join(process.cwd(), PROMPT_FILES.gradeShort);
  const promptTemplate = await readFile(promptPath, "utf-8");

  const instruction = [
    promptTemplate,
    "",
    "Return strict JSON only:",
    '{ "score": number, "feedback": string, "strengths": string[], "gaps": string[] }',
    `Concept: ${input.conceptTitle}`,
    `Question: ${input.questionPrompt}`,
    `Rubric: ${input.rubric}`,
    `UserAnswer: ${input.userAnswer}`,
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
        temperature: 0.2,
        input: instruction,
      }),
    });

    if (!response.ok) {
      const responseBody = truncateForLog(await response.text());
      const code: ShortGradeFailureCode =
        response.status === 401
          ? "provider_401"
          : response.status === 429
            ? "provider_429"
            : "unknown";

      logShortGradeFailure({
        code,
        message: `LLM provider returned non-OK status: ${response.status}`,
        name: "ProviderHttpError",
        status: response.status,
        responseBody,
      });
      return shortGradeFallback(code);
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
    const validated = ShortGradeSchema.safeParse(parsed);

    if (!validated.success) {
      logShortGradeFailure({
        code: "bad_json",
        message: "LLM output JSON failed schema validation",
        name: "BadJsonSchemaError",
      });
      return shortGradeFallback("bad_json");
    }

    return {
      score: clampScore(validated.data.score),
      feedback: validated.data.feedback,
      strengths: validated.data.strengths ?? [],
      gaps: validated.data.gaps ?? [],
    };
  } catch (error) {
    const asError = error instanceof Error ? error : new Error("Unknown grading error");
    logShortGradeFailure({
      code: asError.name === "SyntaxError" ? "bad_json" : "unknown",
      message: asError.message,
      name: asError.name,
    });
    return shortGradeFallback(asError.name === "SyntaxError" ? "bad_json" : "unknown");
  }
}
