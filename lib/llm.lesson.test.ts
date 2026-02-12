vi.mock("server-only", () => ({}));

import { generateLessonContent } from "./llm";

describe("generateLessonContent structure", () => {
  it("includes required headings and a numeric worked example", async () => {
    const previousKey = process.env.LLM_API_KEY;
    process.env.LLM_API_KEY = "";

    const lesson = await generateLessonContent({
      conceptName: "Context Window Management",
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
});
