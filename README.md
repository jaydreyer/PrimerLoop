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

## Environment Variables

Set these in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL for browser + server anon client.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key used by browser auth/session flows.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for admin cache writes.
- `LLM_API_KEY`: server-only key for lesson/quiz generation and short-answer grading.
- `LLM_MODEL`: model id for generation/grading, default `gpt-4.1-mini`.
- `CONTENT_TONE`: optional content framing for generation (`interview` default, or `neutral`).
- `ADMIN_API_KEY`: server-only shared secret required by admin cache routes (`x-admin-api-key`).

## Secret Safety

- Never commit real secrets to source control.
- Keep secret keys only in `.env.local` (and deployment secret managers in prod).
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, or `ADMIN_API_KEY` in client code.
- Restart the dev server after changing `.env.local`.

## Supabase Auth Redirect URLs (Local + LAN)

For magic-link auth to work on both your local machine and devices on your LAN, add both callback URLs in Supabase Auth settings:

- `http://localhost:3001/auth/callback`
- `http://<LAN-IP>:3001/auth/callback`

Use the **Network** URL printed by `next dev` to find your LAN IP, then copy that IP into the second URL.
