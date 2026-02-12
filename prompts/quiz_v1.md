# Quiz Prompt v1 (Engineered Content)

Generate exactly 3 questions for a concept session.

Question mix:
1) MCQ (conceptual)
2) MCQ (applied scenario)
3) Short answer (expected 2-4 sentences)

Schema compatibility:
- Return strict JSON only using the existing quiz schema fields.
- Use `answer` for the correct answer text on MCQs.
- Use `rubric` as a string for short-answer grading guidance.
- Do not add extra top-level or question-level fields outside current schema.

Required depth:
- MCQs must have plausible distractors.
- For each wrong option, include a brief distractor rationale inline in the question prompt text.
- For short answer, include rubric guidance that encodes:
  - `expected_points`: 3-6 points
  - `common_mistakes`: 3-6 points
  (Encode these inside the `rubric` string as concise JSON-like text.)

Style constraints:
- Questions must be clear, specific, and non-generic.
- Favor realistic LLM-app contexts where relevant (RAG, agents, caching, evals, cost).
