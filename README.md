# PrimerLoop

## Project Description

PrimerLoop is a mobile-first PWA for structured learning using short lessons, active recall quizzes, spaced repetition, and a personal notebook. The current curriculum starts with AI & LLM Systems, but the architecture supports multiple subjects.

## Setup Steps

1. Clone the repository.
2. Copy environment template:
   - `cp .env.example .env.local`
3. Install dependencies (inside app folder):
   - `cd primerloop && npm install`
4. Start the dev server:
   - `npm run dev`

## Supabase Setup

1. Create a Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Run SQL in order from `/primerloop/supabase`:
   - `schema.sql`
   - `rls.sql`
   - `seed.sql`
4. Verify RLS is enabled and policies are applied.

## Environment Variables

Defined in `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_KEY`
- `LLM_MODEL` (default: `gpt-4.1-mini`)
- `ADMIN_API_KEY`

## Dev Commands

Run from `/Users/jaydreyer/projects/PrimerLoop/primerloop`:

- `npm install` — install dependencies
- `npm run dev` — run local development server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — lint codebase

## Deployment Steps

1. Set production environment variables in your hosting platform.
2. Provision production Supabase and apply:
   - `/primerloop/supabase/schema.sql`
   - `/primerloop/supabase/rls.sql`
   - `/primerloop/supabase/seed.sql`
3. Build and deploy the app from `primerloop/`.
4. Configure `ADMIN_API_KEY` for admin cache-population routes.
5. Smoke test key routes after deploy (`/today`, session APIs, admin cache routes).
