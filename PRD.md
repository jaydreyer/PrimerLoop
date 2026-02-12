# PrimerLoop PRD (MVP)

## MVP Scope

- Mobile-first PWA learning flow centered on one daily session.
- Daily loop: lesson -> quiz -> mastery update -> notebook entry.
- Curriculum-driven concept system with prerequisites.
- Learner model with `mastery_level (0-3)`, `next_due_at`, and `seen_count`.
- Session planner rules:
  - 1 new concept when prerequisites are satisfied.
  - 0-2 due review concepts.
  - 6-10 total quiz questions.
  - Default track weighting 70% `LLM_APP`, 30% `CORE_TECH`.
- Spaced repetition schedule:
  - Learning (1) -> +2 days
  - Improving (2) -> +5 days
  - Solid (3) -> +14 days
- Cost controls:
  - Lesson caching by `(concept, difficulty)`
  - Quiz caching by `(concept, difficulty, version)`
  - LLM grading only for short answers
  - Lesson length <= 450 words
  - Quiz length <= 10 questions

## Non-Goals

- Video learning features.
- Social, community, or collaboration features.
- Leaderboards or gamified ranking systems.
- Payment/subscription billing.
- Advanced visual concept graph tooling in MVP.

## Acceptance Criteria

1. A user can run one complete daily session from Today -> Lesson -> Quiz -> Results.
2. Session generation includes at most 1 new concept and at most 2 due review concepts.
3. Total questions per session are between 6 and 10.
4. New concept selection enforces prerequisite completion.
5. Mastery updates are persisted and due dates follow 2/5/14 day rules.
6. Notebook entry is generated/saved at session completion.
7. LLM usage is constrained by caching and short-answer-only grading.
8. Data model supports multiple subjects without AI-specific hardcoding.
9. Mobile layout is usable and readable without terminal-style presentation.
10. API routes exist for today session fetch, start, answer submission, and completion.
