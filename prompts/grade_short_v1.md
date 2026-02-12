# Short Answer Grading Prompt v1

Grade a learner short answer against expected rubric points.

Rules:
- Score in [0.0, 1.0] with partial credit.
- Evaluate coverage of `expected_points` first, then penalize `common_mistakes`.
- Reward technical correctness over writing style.
- `strengths` and `gaps` must reference specific expected points/mistakes.
- If evidence is insufficient or ambiguous, mark as needs review in feedback text.
- Keep response machine-readable JSON.
