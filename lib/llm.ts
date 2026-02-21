import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Difficulty } from "./types";
import { PROMPT_FILES } from "./prompts";
import { createSupabaseUserServer } from "./supabaseUserServer";
import { requireLlmApiKey } from "./env.server";
import { NotebookEntrySchema, type NotebookEntry } from "./notebook";
import contentSlugAliases from "../config/content-slug-aliases.json";

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
  conceptSlug?: string;
  difficulty: Difficulty;
  subjectName: string;
};

type GenerateQuizInput = {
  conceptName: string;
  conceptSlug?: string;
  difficulty: Difficulty;
  subjectName: string;
};

type ContentTone = "interview" | "neutral";

function contentTone(): ContentTone {
  return process.env.CONTENT_TONE === "neutral" ? "neutral" : "interview";
}

type GenerateNotebookEntryInput = {
  conceptTitle: string;
  lesson: LessonContent;
  quizResults?: unknown;
};

const CuratedLessonSchema = z.object({
  why_it_matters: z.string().optional(),
  core_idea: z.string().optional(),
  mental_model: z.string().optional(),
  deep_dive: z.string().optional(),
  applied_example: z.string().optional(),
  failure_modes: z.string().optional(),
  design_implications: z.string().optional(),
  interview_angle: z.string().optional(),
  compression_summary: z.string().optional(),
});

const CuratedQuizQuestionSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: z.enum(["mcq", "short"]),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    correct_index: z.number().int().nonnegative().optional(),
    explanation: z.string().optional(),
    grading_notes: z.string().optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "mcq" && (!question.options || question.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Curated MCQ questions require at least two options",
        path: ["options"],
      });
    }
    if (
      question.type === "mcq" &&
      typeof question.correct_index === "number" &&
      question.options &&
      question.correct_index >= question.options.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Curated correct_index is out of range",
        path: ["correct_index"],
      });
    }
  });

const CuratedConceptSchema = z.object({
  subject_slug: z.string().min(1),
  concept_slug: z.string().min(1),
  track: z.string().min(1),
  difficulty: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string().min(1),
  prerequisites: z.array(z.string()).optional(),
  lesson: CuratedLessonSchema,
  quiz: z.array(CuratedQuizQuestionSchema).min(1),
});

type CuratedConcept = z.infer<typeof CuratedConceptSchema>;

type CuratedContentIndex = {
  bySlug: Map<string, CuratedConcept>;
  byTitle: Map<string, CuratedConcept>;
};

const globalForCuratedContent = globalThis as unknown as {
  __curatedContentIndexPromise?: Promise<CuratedContentIndex>;
};

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

const slugAliasMap = Object.entries(contentSlugAliases).reduce((acc, [source, target]) => {
  const sourceKey = normalizeLookupKey(source);
  const targetKey = normalizeLookupKey(target);
  if (sourceKey && targetKey) {
    acc.set(sourceKey, targetKey);
  }
  return acc;
}, new Map<string, string>());

function slugFromConceptName(name: string): string {
  return normalizeLookupKey(name)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function expandSlugCandidates(candidates: string[]): string[] {
  const expanded: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    expanded.push(candidate);

    const aliasTarget = slugAliasMap.get(candidate);
    if (aliasTarget && !seen.has(aliasTarget)) {
      seen.add(aliasTarget);
      expanded.push(aliasTarget);
    }
  }

  return expanded;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeLookupKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

function firstMeaningfulSentence(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const match = compact.match(/(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? compact).trim();
}

function textBlockToBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[•*-]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [text.trim()];
}

function lessonSectionFromField(
  lesson: CuratedConcept["lesson"],
  field: keyof CuratedConcept["lesson"],
  heading: string,
): LessonContent["sections"][number] | null {
  const value = lesson[field];
  if (typeof value !== "string" || !value.trim()) return null;
  return {
    heading,
    bullets: textBlockToBullets(value),
  };
}

function buildCuratedLessonContent(curated: CuratedConcept): LessonContent | null {
  const sections = [
    lessonSectionFromField(curated.lesson, "why_it_matters", "Why It Matters"),
    lessonSectionFromField(curated.lesson, "core_idea", "Core Idea"),
    lessonSectionFromField(curated.lesson, "mental_model", "Mental Model"),
    lessonSectionFromField(curated.lesson, "deep_dive", "Deep Dive"),
    lessonSectionFromField(curated.lesson, "applied_example", "Worked Example"),
    lessonSectionFromField(curated.lesson, "failure_modes", "Failure Modes"),
    lessonSectionFromField(curated.lesson, "design_implications", "Design Implications"),
    lessonSectionFromField(curated.lesson, "interview_angle", "Interview Angle"),
    lessonSectionFromField(curated.lesson, "compression_summary", "60-second recap"),
  ].filter((section): section is LessonContent["sections"][number] => Boolean(section));

  if (sections.length === 0) return null;

  const keyTakeaways = dedupeStrings(
    [
      curated.lesson.compression_summary,
      curated.lesson.core_idea,
      curated.lesson.design_implications,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => firstMeaningfulSentence(value)),
  ).slice(0, 4);

  const lessonCandidate: LessonContent = {
    title: curated.title,
    sections,
    key_takeaways: keyTakeaways.length > 0 ? keyTakeaways : ["Review the core idea and apply it with one concrete example."],
  };

  const validated = LessonContentSchema.safeParse(lessonCandidate);
  return validated.success ? validated.data : null;
}

function buildCuratedQuizContent(curated: CuratedConcept): QuizContent | null {
  const questions: QuizContent["questions"] = curated.quiz.map((question, index) => {
    if (question.type === "mcq") {
      const choices = question.options ?? [];
      const correctIndex = question.correct_index;
      return {
        id: question.id ?? `q${index + 1}`,
        type: "mcq",
        prompt: question.question,
        choices,
        correctIndex,
        answer:
          typeof correctIndex === "number" && choices[correctIndex]
            ? choices[correctIndex]
            : undefined,
      };
    }

    return {
      id: question.id ?? `q${index + 1}`,
      type: "short",
      prompt: question.question,
      rubric: question.grading_notes ?? "Assess conceptual correctness and clarity.",
    };
  });

  const quizCandidate: QuizContent = {
    title: `${curated.title} Quiz`,
    questions,
  };

  const validated = QuizContentSchema.safeParse(quizCandidate);
  return validated.success ? validated.data : null;
}

async function loadCuratedContentIndex(): Promise<CuratedContentIndex> {
  const existing = globalForCuratedContent.__curatedContentIndexPromise;
  if (existing) return existing;

  const indexPromise = (async () => {
    const bySlug = new Map<string, CuratedConcept>();
    const byTitle = new Map<string, CuratedConcept>();
    const contentRoot = path.join(process.cwd(), "content");
    const dirs = ["foundations", "llm-app", "systems"];

    for (const dir of dirs) {
      const dirPath = path.join(contentRoot, dir);
      let filenames: string[] = [];
      try {
        filenames = await readdir(dirPath);
      } catch {
        continue;
      }

      for (const filename of filenames) {
        if (!filename.endsWith(".json")) continue;
        const filePath = path.join(dirPath, filename);
        let raw = "";
        try {
          raw = await readFile(filePath, "utf-8");
        } catch {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        const validated = CuratedConceptSchema.safeParse(parsed);
        if (!validated.success) continue;

        const concept = validated.data;
        const slugKey = normalizeLookupKey(concept.concept_slug);
        const titleKey = normalizeLookupKey(concept.title);
        if (slugKey && !bySlug.has(slugKey)) bySlug.set(slugKey, concept);
        if (titleKey && !byTitle.has(titleKey)) byTitle.set(titleKey, concept);
      }
    }

    return { bySlug, byTitle };
  })();

  globalForCuratedContent.__curatedContentIndexPromise = indexPromise;
  return indexPromise;
}

async function getCuratedConceptContent(input: {
  conceptSlug?: string;
  conceptName: string;
}): Promise<CuratedConcept | null> {
  const index = await loadCuratedContentIndex();

  const slugCandidates = [
    input.conceptSlug,
    slugFromConceptName(input.conceptName),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeLookupKey(value));

  const expandedSlugCandidates = expandSlugCandidates(slugCandidates);

  for (const slugKey of expandedSlugCandidates) {
    const hit = index.bySlug.get(slugKey);
    if (hit) return hit;
  }

  const titleHit = index.byTitle.get(normalizeLookupKey(input.conceptName));
  return titleHit ?? null;
}

function fallbackLessonContent(input: GenerateLessonInput): LessonContent {
  const conceptSlug = input.conceptSlug?.trim().toLowerCase();
  const title = `${input.conceptName} (${input.difficulty})`;

  if (conceptSlug === "tokens-context") {
    return {
      title,
      sections: [
        {
          heading: "Core Idea",
          bullets: [
            "A token is a model-specific text unit; token is not the same as a word, and token is not the same as a character.",
            "Context window is the total token budget available for one request-response cycle.",
            "In practice, total tokens = input tokens + output tokens, so long prompts directly reduce response room.",
          ],
        },
        {
          heading: "Mental Model",
          bullets: [
            "Treat context like a fixed-size container: every system instruction, user message, and retrieved chunk consumes space before the model can generate output.",
          ],
        },
        {
          heading: "Worked Example",
          bullets: [
            'Sentence tokenization example: "Hello world" might tokenize as ["Hello", " world"]; many tokenizers attach leading whitespace to the next token, so the second token starts with a space.',
            "Tokenization edge cases: emojis and long numbers are often split into multiple tokens, which can increase token count unexpectedly.",
            "Context window example: with an 8k-token window and a 7,500-token prompt, only 500 tokens remain for output.",
            "Long system prompt example: if system instructions take 2,000 tokens in an 8k window, the remaining budget for user input, retrieved context, and output drops sharply.",
            "Context truncation example: with a 8,192-token limit, a 8,900-token request forces truncation; the last 708 tokens are dropped, which can remove critical instructions.",
            "Near context limits, responses degrade because important earlier tokens may be truncated and the model has too little remaining output budget for complete reasoning.",
            "Cost math example: if input is 6,000 tokens at $0.50 per 1M and output is 700 tokens at $1.50 per 1M, request cost is (6,000/1,000,000)*0.50 + (700/1,000,000)*1.50 = $0.00405.",
            "Why tokenization matters for cost: billing is token-based, so higher token counts from chunking/tokenization directly increase spend.",
          ],
        },
        {
          heading: "Interview Angle",
          bullets: [
            "Explain how you estimate token budgets before shipping a prompt chain.",
            "Mention concrete truncation safeguards (summarization, chunk limits, retrieval reranking).",
            "Common trap: discussing quality improvements without proving context fits in budget.",
          ],
        },
        {
          heading: "System Design Connection",
          bullets: [
            "RAG quality depends on selecting the highest-signal passages that still fit context.",
            "Agent pipelines need per-step context caps so tool traces do not crowd out user intent.",
            "Token accounting is required for both latency and cost guardrails in production.",
          ],
        },
        {
          heading: "60-second recap",
          bullets: [
            "Tokens determine how text is counted; context sets a hard capacity limit. Strong LLM app design budgets tokens, prevents truncation of important content, and verifies per-request cost before scaling traffic.",
          ],
        },
      ],
      key_takeaways: [
        "Token counts are model-specific and not equal to word counts.",
        "Context overflow silently drops useful information unless guarded.",
        "Token budgeting should be part of both quality and cost design.",
      ],
    };
  }

  if (conceptSlug === "sampling-generation") {
    return {
      title,
      sections: [
        {
          heading: "Core Idea",
          bullets: [
            "Generation is next-token prediction repeated until a stop condition is met.",
            "Decoding strategy controls whether output is conservative, varied, or unstable.",
            "Sampling choices should match the product goal: consistency for workflows, creativity for ideation.",
          ],
        },
        {
          heading: "Mental Model",
          bullets: [
            "Imagine a weighted roulette wheel over candidate next tokens: decoding rules decide whether you always take the top slice or allow lower-probability slices.",
          ],
        },
        {
          heading: "Worked Example",
          bullets: [
            "Greedy decoding always picks the highest-probability token at each step, which maximizes local certainty but can make phrasing repetitive.",
            "Temperature rescales probabilities: low values sharpen toward likely tokens, higher values flatten and increase diversity.",
            "Top-p keeps the smallest token set whose cumulative probability reaches p (for example p=0.9), then samples only from that set.",
            'Example prompt: "Write one line inviting users to start today\'s lesson." Low temperature output: "Start today\'s lesson now to build steady progress." High temperature output: "Jump into today\'s lesson and spark a fresh chain of ideas."',
            "They differ because low temperature concentrates probability mass on common phrasing, while high temperature allows lower-probability wording choices.",
          ],
        },
        {
          heading: "Interview Angle",
          bullets: [
            "State where deterministic output is required (grading, safety policy responses, structured extraction).",
            "Explain where controlled randomness helps (brainstorming, style variation, marketing drafts).",
            "Common trap: changing temperature without monitoring factual accuracy and format adherence.",
          ],
        },
        {
          heading: "System Design Connection",
          bullets: [
            "For agents, deterministic decoding reduces flaky tool-call plans.",
            "For creative assistants, moderate temperature plus top-p can improve variety without full drift.",
            "Eval suites should track how decoding settings affect correctness, latency, and refusal behavior.",
          ],
        },
        {
          heading: "60-second recap",
          bullets: [
            "LLM generation is iterative next-token prediction. Greedy decoding is stable but narrow; temperature and top-p introduce controlled randomness. Pick decoding settings based on whether your feature needs strict repeatability or varied expression.",
          ],
        },
      ],
      key_takeaways: [
        "Greedy decoding favors deterministic, repeatable outputs.",
        "Temperature controls randomness by reshaping token probabilities.",
        "Top-p sampling limits choices to a cumulative-probability frontier.",
        "Use determinism for reliability and randomness for creative range.",
      ],
    };
  }

  return {
    title,
    sections: [
      {
        heading: "Core Idea",
        bullets: [
          `${input.conceptName} in ${input.subjectName} is used to make model behavior reliable under real product constraints.`,
          "It matters when latency, token cost, and answer quality must be balanced in one design.",
          "You should be able to explain what signal it improves and what failure mode it reduces.",
        ],
      },
      {
        heading: "Mental Model",
        bullets: [
          "Think of this as a control surface: you tune one lever to improve quality while protecting latency and spend.",
        ],
      },
      {
        heading: "Worked Example",
        bullets: [
          "A support bot has a p95 latency budget of 2.0s and a max response cost of $0.02; adding query caching raises cache hit rate to 62%, cutting p95 from 2.8s to 1.6s.",
        ],
      },
      {
        heading: "Interview Angle",
        bullets: [
          "Interviewers probe tradeoffs: what gets worse when this gets better?",
          "They often ask for failure modes and mitigation, not just a definition.",
          "Common trap: describing the concept abstractly without metrics or constraints.",
        ],
      },
      {
        heading: "System Design Connection",
        bullets: [
          "In RAG systems, this influences retrieval precision versus latency budget.",
          "In agent flows, it affects loop stability, tool-call count, and cost ceilings.",
          "In eval pipelines, it changes what quality regressions you can detect early.",
        ],
      },
      {
        heading: "60-second recap",
        bullets: [
          `${input.conceptName} is useful when you must improve answer quality without breaking latency or cost constraints. In interviews, tie it to a concrete scenario, name one metric, and explain a tradeoff plus mitigation.`,
        ],
      },
    ],
    key_takeaways: [
      "Define it with one concrete scenario, not generic language.",
      "Anchor your explanation to a measurable constraint.",
      "State one tradeoff and one mitigation.",
      "Connect it to RAG, agents, caching, evals, or cost control.",
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
        prompt: `Conceptual MCQ: Which statement best describes ${input.conceptName}?`,
        choices: [
          `It helps balance quality, latency, and cost in ${input.subjectName} systems.`,
          "It is a front-end styling framework.",
          "It is only relevant to offline model training.",
          "It replaces the need for evaluation.",
        ],
        answer: `It helps balance quality, latency, and cost in ${input.subjectName} systems.`,
      },
      {
        id: "q2",
        type: "mcq",
        prompt:
          "Applied MCQ: A RAG endpoint exceeds a 2.0s p95 latency budget during traffic spikes. Which change is most likely to help first?",
        choices: [
          "Add retrieval-result caching and measure hit rate, latency, and answer quality.",
          "Increase prompt length for every request regardless of query type.",
          "Disable monitoring to reduce instrumentation overhead.",
          "Always run the largest model variant for every request.",
        ],
        answer: "Add retrieval-result caching and measure hit rate, latency, and answer quality.",
      },
      {
        id: "q3",
        type: "short",
        prompt: `In 2-4 sentences, explain how ${input.conceptName} changes design choices in an LLM app.`,
        rubric:
          'expected_points:["names one concrete app scenario","mentions at least one metric or limit","describes a tradeoff and mitigation"];common_mistakes:["generic definition only","no measurable constraint","no tradeoff discussion"]',
      },
    ],
  };
}

function fallbackNotebookEntry(input: GenerateNotebookEntryInput): NotebookEntry {
  return {
    conceptTitle: input.conceptTitle,
    summary: `${input.conceptTitle} is a practical concept used to make system behavior more reliable and explainable in interviews and production decisions.`,
    definition: `${input.conceptTitle} is a core idea that links technical choices to measurable outcomes and tradeoffs.`,
    whyItMatters: [
      "Improves clarity when explaining architecture decisions under constraints.",
      "Helps justify tradeoffs with concrete reasoning instead of vague claims.",
      "Supports better debugging and iteration when performance changes.",
    ],
    commonPitfalls: [
      "Using the concept without defining success metrics first.",
      "Ignoring edge cases that break assumptions in production.",
      "Over-optimizing complexity before validating baseline correctness.",
    ],
    microExample:
      "A service with 200ms latency budget adds a retrieval step; by caching top queries, p95 drops from 380ms to 170ms while accuracy remains stable.",
    flashcards: [
      { q: `What problem does ${input.conceptTitle} solve?`, a: "It connects design choices to outcomes and tradeoffs." },
      { q: `How do you evaluate ${input.conceptTitle}?`, a: "Use explicit metrics, constraints, and failure modes." },
      { q: `What is a common mistake with ${input.conceptTitle}?`, a: "Skipping validation and relying on assumptions." },
    ],
    tags: ["architecture", "tradeoffs", "interview", "systems", "debugging"],
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

function normalizeLessonSections(lesson: LessonContent): LessonContent {
  const filteredSections = lesson.sections.filter(
    (section) => section.heading.trim().toLowerCase() !== "key takeaways",
  );
  return {
    ...lesson,
    sections: filteredSections,
  };
}

export async function generateLessonContent(input: GenerateLessonInput): Promise<LessonContent> {
  const curatedConcept = await getCuratedConceptContent({
    conceptSlug: input.conceptSlug,
    conceptName: input.conceptName,
  });
  if (curatedConcept) {
    const curatedLesson = buildCuratedLessonContent(curatedConcept);
    if (curatedLesson) {
      return curatedLesson;
    }
  }

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
    "Required section headings: Core Constraint, Mental Model, Concrete Mechanism, Failure Mode, Design Consequence, Transfer Test, 60-Second Compression.",
    'Do not include "Key Takeaways" as a section heading in sections; use key_takeaways array only.',
    "Worked Example must include at least one concrete number, limit, or constraint.",
    `Tone: ${contentTone()} (${contentTone() === "interview" ? "Bias toward LLM app interview framing." : "Use neutral instructional framing."})`,
    `Concept: ${input.conceptName}`,
    `ConceptSlug: ${input.conceptSlug ?? ""}`,
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

    return normalizeLessonSections(validated.data);
  } catch {
    return fallbackLessonContent(input);
  }
}

export async function generateQuizContent(input: GenerateQuizInput): Promise<QuizContent> {
  const curatedConcept = await getCuratedConceptContent({
    conceptSlug: input.conceptSlug,
    conceptName: input.conceptName,
  });
  if (curatedConcept) {
    const curatedQuiz = buildCuratedQuizContent(curatedConcept);
    if (curatedQuiz) {
      return curatedQuiz;
    }
  }

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
    "Generate exactly 3 questions: conceptual mcq, applied scenario mcq, and one short answer.",
    `Tone: ${contentTone()} (${contentTone() === "interview" ? "Bias toward LLM app interview framing." : "Use neutral instructional framing."})`,
    `Concept: ${input.conceptName}`,
    `ConceptSlug: ${input.conceptSlug ?? ""}`,
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

export async function generateNotebookEntryContent(
  input: GenerateNotebookEntryInput,
): Promise<NotebookEntry> {
  let llmApiKey: string;
  try {
    llmApiKey = requireLlmApiKey();
  } catch {
    return fallbackNotebookEntry(input);
  }

  const model = process.env.LLM_MODEL ?? "gpt-4.1-mini";
  const promptPath = path.join(process.cwd(), PROMPT_FILES.notebookEntry);
  const promptTemplate = await readFile(promptPath, "utf-8");

  const instruction = [
    promptTemplate,
    "",
    "Return strict JSON only with this exact shape:",
    '{ "conceptTitle": string, "summary": string, "definition": string, "whyItMatters": string[], "commonPitfalls": string[], "microExample": string, "flashcards": [{ "q": string, "a": string }], "tags": string[] }',
    `ConceptTitle: ${input.conceptTitle}`,
    `LessonJSON: ${JSON.stringify(input.lesson)}`,
    `QuizResultsJSON: ${JSON.stringify(input.quizResults ?? null)}`,
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
      return fallbackNotebookEntry(input);
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
    const validated = NotebookEntrySchema.safeParse(parsed);
    if (!validated.success) {
      return fallbackNotebookEntry(input);
    }

    return validated.data;
  } catch {
    return fallbackNotebookEntry(input);
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
