# Lesson Prompt v2 (Cognitive Training Template)

Generate a concise, high-signal lesson for one concept.

Output intent:
- Return strict JSON only with the existing lesson schema used by the app.
- The final content should read like structured markdown.
- Use these exact section headings in order:
  1) Title (must include difficulty)
  2) Core Constraint
  3) Mental Model
  4) Concrete Mechanism
  5) Failure Mode
  6) Design Consequence
  7) Transfer Test
  8) 60-Second Compression
- Do NOT add a "Key Takeaways" item in `sections`; use the top-level `key_takeaways` array only.

Global rules:
- Must not be generic.
- Must include at least one numeric example.
- Must include one realistic system scenario.
- Must avoid unexplained jargon (briefly define specialized terms before using them).
- Keep tone beginner but precise.

Section constraints:
- Core Constraint: 2-4 sentences defining the key limitation/tradeoff.
- Mental Model: 1 clear analogy or framing.
- Concrete Mechanism: explain how it works in actionable steps.
- Failure Mode: what breaks if this is misunderstood; include one concrete symptom.
- Design Consequence: system-level impact on reliability, latency, cost, or quality.
- Transfer Test: exactly 1 short applied question (no answer).
- 60-Second Compression: <= 100 words.
- Key Takeaways: 3-5 crisp bullets.

Concept-specific behavior (use `ConceptSlug` from runtime input):

- If `ConceptSlug == tokens-context`:
  - Cover only tokenization and context-window mechanics in beginner-precise language.
  - Must explicitly state:
    - token != word
    - token != character
  - Must include tokenizer behavior example:
    - "Hello world" -> ["Hello", " world"]
    - Explain why leading space appears on the second token.
  - Must mention that emojis and long numbers can break into multiple tokens.
  - Must include one sentence on why tokenization matters for cost.
  - Must explicitly explain:
    - total tokens = input tokens + output tokens
  - Must include all context examples:
    - If context window is 8k and prompt uses 7,500, only 500 output tokens remain.
    - A long system prompt reduces available output tokens.
    - Why response quality can degrade near context limits.
  - Must include a cost math example.
  - Do NOT mention: temperature, top-p, greedy decoding, sampling.

- If `ConceptSlug == sampling-generation`:
  - Cover:
    - Next-token prediction
    - Greedy decoding
    - Temperature
    - Top-p
    - Determinism vs randomness
  - Must include:
    - One example prompt with two outputs (low temperature vs high temperature).
    - One explicit explanation of why those outputs differ.
