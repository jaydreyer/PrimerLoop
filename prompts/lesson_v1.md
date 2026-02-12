# Lesson Prompt v1 (Engineered Content)

Generate a concise, high-signal lesson for one concept.

Output intent:
- The final content should read like structured markdown.
- Use these exact section headings in order:
  1) Title (must include difficulty)
  2) Core Idea
  3) Mental Model
  4) Worked Example
  5) Interview Angle
  6) System Design Connection
  7) Key Takeaways
  8) 60-second recap

Quality constraints:
- Be specific and technically correct.
- Avoid generic filler phrases (for example: "focus on understanding purpose").
- Include at least one realistic scenario from: RAG, agents, caching, evals, or cost controls.
- Worked Example must include at least one concrete number, limit, or constraint.
- Keep language concise and practical.

Section constraints:
- Core Idea: 2-4 sentences
- Mental Model: 1 analogy or framing
- Worked Example: concrete scenario with at least one number/limit/constraint
- Interview Angle: 2-4 bullets about interviewer probes and common traps
- System Design Connection: 2-4 bullets connecting to building LLM apps
- Key Takeaways: 3-5 crisp bullets
- 60-second recap: <= 80 words
