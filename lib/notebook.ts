import { z } from "zod";

export const NotebookEntrySchema = z.object({
  conceptTitle: z.string().min(1),
  summary: z.string().min(1),
  definition: z.string().min(1),
  whyItMatters: z.array(z.string().min(1)).min(3).max(6),
  commonPitfalls: z.array(z.string().min(1)).min(3).max(6),
  microExample: z.string().min(1),
  flashcards: z
    .array(
      z.object({
        q: z.string().min(1),
        a: z.string().min(1),
      }),
    )
    .min(3)
    .max(6),
  tags: z.array(z.string().min(1)).min(3).max(8),
});

export type NotebookEntry = z.infer<typeof NotebookEntrySchema>;
