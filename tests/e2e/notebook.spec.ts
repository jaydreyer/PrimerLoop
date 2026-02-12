import { expect, test } from "@playwright/test";

test("notebook concept page renders generated note", async ({ page }) => {
  await page.route("**/api/notebook/concept-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        conceptId: "concept-1",
        cached: false,
        entry: {
          conceptTitle: "Transformers",
          summary: "Attention-based architecture for sequence modeling.",
          definition: "A model family built on self-attention.",
          whyItMatters: ["Scales to long context", "Parallelizable training", "Strong transfer learning"],
          commonPitfalls: ["Ignoring positional encoding", "Overlooking context limits", "No evaluation guardrails"],
          microExample: "Use retrieval to keep prompts small while preserving relevance.",
          flashcards: [
            { q: "Core mechanism?", a: "Self-attention." },
            { q: "Why better than RNNs?", a: "Parallelizable sequence processing." },
            { q: "Main risk?", a: "Hallucinations without grounding." },
          ],
          tags: ["llm", "architecture", "attention"],
        },
      }),
    });
  });

  await page.goto("/notebook/concept-1");
  await expect(page.getByRole("heading", { name: "Transformers" })).toBeVisible();
  await expect(page.getByText("Generated now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flashcards" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to notebook" })).toBeVisible();
});
