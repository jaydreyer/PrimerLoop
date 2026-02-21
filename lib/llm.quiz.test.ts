vi.mock("server-only", () => ({}));

import { generateQuizContent } from "./llm";

describe("generateQuizContent curated alias resolution", () => {
  it("resolves legacy prompting-basics slug to curated quiz content", async () => {
    const previousKey = process.env.LLM_API_KEY;
    process.env.LLM_API_KEY = "";

    const quiz = await generateQuizContent({
      conceptName: "Prompting Basics",
      conceptSlug: "prompting-basics",
      difficulty: "beginner",
      subjectName: "AI & LLM Systems",
    });

    if (typeof previousKey === "string") {
      process.env.LLM_API_KEY = previousKey;
    } else {
      delete process.env.LLM_API_KEY;
    }

    expect(quiz.title).toBe(
      "Prompt Engineering: Designing Inputs That Produce Better Outputs Quiz",
    );
    expect(quiz.questions.length).toBe(5);
    expect(quiz.questions[0]?.type).toBe("mcq");
    expect(quiz.questions[0]?.prompt).toContain("primary goal of prompt engineering");

    const shortQuestion = quiz.questions.find((question) => question.type === "short");
    expect(shortQuestion).toBeDefined();
    expect(shortQuestion?.rubric).toContain("Look for:");
  });
});
