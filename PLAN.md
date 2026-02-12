# PrimerLoop Implementation Plan (Next 10 Tasks)

1. Initialize runnable Next.js app in `primerloop/` (package.json, tsconfig, app layout, global styles).
2. Build mobile-first shell UI components (card layout, typography scale, spacing system).
3. Implement Supabase client/server wiring with environment validation and typed helpers.
4. Apply `supabase/schema.sql`, `supabase/rls.sql`, and seed baseline subject data.
5. Implement `GET /api/session/today` using concept graph + learner state + session engine.
6. Implement `POST /api/session/start` and `GET /api/session/[id]` for session lifecycle.
7. Implement quiz answer pipeline (`POST /api/quiz/answer`) with objective scoring and short-answer LLM grading path.
8. Implement `POST /api/session/complete` to update mastery, due dates, and notebook entries.
9. Build end-to-end daily flow pages (`today`, `lesson`, `quiz`, `results`, `notebook`) against real APIs.
10. Add basic tests for session planning/mastery logic plus API smoke tests.
