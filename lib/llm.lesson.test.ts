vi.mock("server-only", () => ({}));

import { generateLessonContent } from "./llm";

describe("generateLessonContent structure", () => {
  it("includes required headings and a numeric worked example", async () => {
    const previousKey = process.env.LLM_API_KEY;
    process.env.LLM_API_KEY = "";

    const lesson = await generateLessonContent({
      conceptName: "Context Window Management",
      conceptSlug: "context-window-management",
      difficulty: "intermediate",
      subjectName: "AI & LLM Systems",
    });

    if (typeof previousKey === "string") {
      process.env.LLM_API_KEY = previousKey;
    } else {
      delete process.env.LLM_API_KEY;
    }

    const headings = lesson.sections.map((section) => section.heading);
    expect(headings).toEqual(
      expect.arrayContaining([
        "Core Idea",
        "Mental Model",
        "Worked Example",
        "Interview Angle",
        "System Design Connection",
        "60-second recap",
      ]),
    );

    const workedExample = lesson.sections.find((section) => section.heading === "Worked Example");
    expect(workedExample).toBeDefined();
    expect((workedExample?.bullets ?? []).join(" ")).toMatch(/\d/);
  });

  it("resolves legacy tokens-context slug to curated tokens content", async () => {
    const previousKey = process.env.LLM_API_KEY;
    process.env.LLM_API_KEY = "";

    const lesson = await generateLessonContent({
      conceptName: "Tokens & Context",
      conceptSlug: "tokens-context",
      difficulty: "beginner",
      subjectName: "AI & LLM Systems",
    });

    if (typeof previousKey === "string") {
      process.env.LLM_API_KEY = previousKey;
    } else {
      delete process.env.LLM_API_KEY;
    }

    const text = [
      lesson.title,
      ...lesson.sections.map((section) => `${section.heading} ${section.bullets.join(" ")}`),
      ...lesson.key_takeaways,
    ]
      .join(" ")
      .toLowerCase();

    expect(lesson.title).toBe("Tokens: How Text Becomes Numbers");
    expect(text).toContain("llms do not read words");
    expect(text).toContain("the model predicts the next token");
    expect(text).toContain("token ids");
    expect(text).not.toContain("cost math example");
  });

  it("resolves legacy sampling-generation slug to curated sampling content", async () => {
    const previousKey = process.env.LLM_API_KEY;
    process.env.LLM_API_KEY = "";

    const lesson = await generateLessonContent({
      conceptName: "Sampling & Generation Behavior",
      conceptSlug: "sampling-generation",
      difficulty: "beginner",
      subjectName: "AI & LLM Systems",
    });

    if (typeof previousKey === "string") {
      process.env.LLM_API_KEY = previousKey;
    } else {
      delete process.env.LLM_API_KEY;
    }

    const text = [
      lesson.title,
      ...lesson.sections.map((section) => `${section.heading} ${section.bullets.join(" ")}`),
      ...lesson.key_takeaways,
    ]
      .join(" ")
      .toLowerCase();

    expect(lesson.title).toBe("Sampling: How the Model Chooses the Next Token");
    expect(text).toContain("probability distribution");
    expect(text).toContain("temperature");
    expect(text).toContain("top-p");
    expect(text).toContain("top-k");
    expect(text).not.toContain("they differ because");
  });
});
