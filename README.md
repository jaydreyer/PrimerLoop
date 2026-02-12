# PrimerLoop

PrimerLoop is a mobile-first PWA for structured learning with short lessons, active recall quizzes, spaced repetition, and a personal notebook.

## Product Principles

- One focused daily session (10-15 minutes)
- Structured learning via concept graph + learner model
- Calm, readable UX (not gamified noise)
- Low-cost LLM usage through caching and bounded generation

## Core Engines

1. Concept graph (curriculum structure)
2. Learner model (mastery + review scheduling)
3. Daily loop (lesson -> quiz -> mastery update -> notebook)

## Domain Rules

- Mastery levels: `0 Unseen`, `1 Learning`, `2 Improving`, `3 Solid`
- Review intervals: `Learning +2d`, `Improving +5d`, `Solid +14d`
- Daily session composition:
  - `1` new concept (if prerequisites are met)
  - `0-2` review concepts due
  - `6-10` quiz questions total
- Default track weighting: `70%` LLM app, `30%` core tech

## Cost Constraints

- Cache lessons by `(concept, difficulty)`
- Cache quizzes by `(concept, difficulty, version)`
- Use LLM grader only for short answers
- Keep lessons under `450` words
- Keep quizzes under `10` questions

## Scope

MVP excludes video, social features, leaderboards, and payments.
Architecture is designed for multiple subjects and future curriculum bundles.
