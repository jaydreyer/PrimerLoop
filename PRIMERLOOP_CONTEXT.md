# PrimerLoop — Product Context

## What PrimerLoop Is

PrimerLoop is a mobile-first web app (PWA) for structured learning through:

- Short text lessons
- Active recall quizzes
- Spaced repetition review
- A growing personal knowledge notebook

It is designed to feel like a focused daily training system, not a content platform.

The first subject is:
AI & LLM Systems (70% LLM app interviews, 30% core ML/tech fundamentals)

However, the architecture must support multiple subjects in the future.

AI is NOT hardcoded into the system.

---

## Core Philosophy

PrimerLoop is built around three engines:

1. Concept Graph (structured curriculum)
2. Learner Model (what the user knows)
3. Daily Loop (lesson → quiz → mastery update → notebook)

It is NOT a random quiz generator.

It is NOT a generic flashcard app.

It is NOT a video platform.

It is a structured knowledge acquisition system.

---

## User Experience Goals

- Feels like a clean mobile app
- One focused session per day (10–15 minutes)
- Calm, not gamified chaos
- Structured, not overwhelming
- Encouraging but serious

No terminal-style UI.
Use cards, spacing, readable typography.

---

## Learning Model

Each Concept has:
- subject
- track (LLM_APP or CORE_TECH)
- difficulty (beginner/intermediate/advanced)
- prerequisites (concept graph)

Each User has:
- mastery_level per concept (0–3)
- next_due_at
- seen_count

Mastery levels:
0 = Unseen
1 = Learning
2 = Improving
3 = Solid

Spaced repetition intervals:
Learning → +2 days
Improving → +5 days
Solid → +14 days

---

## Daily Session Rules

Each day:
- 1 new concept (if prerequisites satisfied)
- 0–2 review concepts due
- 6–10 quiz questions total

Track mix:
Default weighting:
70% LLM_APP
30% CORE_TECH

Session length target:
12 minutes default (10–15 adjustable)

---

## Cost Constraints

PrimerLoop must minimize LLM usage.

Rules:
- Cache generated lessons per (concept, difficulty)
- Cache generated quizzes per (concept, difficulty, version)
- Only call LLM grader for short answers
- Keep lessons under 450 words
- Keep quizzes under 10 questions

---

## Non-Goals (MVP)

- No video learning
- No social features
- No leaderboards
- No payment system
- No advanced visual concept graph UI

---

## Future Expansion

Architecture must support:
- Multiple Subjects
- Multiple Curriculum Bundles
- Interview Mode (PM vs Engineer)
- More advanced spaced repetition
- Additional domains beyond AI

Do not hardcode anything specifically to AI.
AI is just the first subject.
