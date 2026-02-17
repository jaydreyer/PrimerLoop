# Tech Debt Log

## Next.js 16 middleware deprecation (`middleware.ts` -> `proxy.ts`)

- Status: Closed
- Priority: Medium
- Owner: Codex
- First observed: 2026-02-12

### Current behavior

- The app uses root `proxy.ts` to:
  - refresh Supabase SSR auth cookies (`createServerClient(...); await supabase.auth.getUser()`),
  - apply security headers,
  - enforce a basic in-memory rate limit for `/api/*`.
- Migrated to Next.js 16 `proxy.ts` + `export function proxy()`.
- Deprecation warning is cleared while preserving prior runtime behavior.

### References

- Next.js v16 upgrade guide (`middleware` to `proxy`): https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js message: Renaming Middleware to Proxy: https://nextjs.org/docs/messages/middleware-to-proxy
- Next.js proxy file convention docs: https://nextjs.org/docs/app/api-reference/file-conventions/middleware
- Supabase Auth + Next.js (SSR/App Router): https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase `@supabase/ssr` migration guidance: https://supabase.com/docs/guides/auth/auth-helpers/nextjs-pages

### Migration plan (placeholder)

- [x] Confirm target runtime behavior for auth refresh, security headers, and rate limiting under `proxy.ts`.
- [x] Rename file/function: `middleware.ts` -> `proxy.ts`, `middleware()` -> `proxy()`.
- [x] Verify Supabase SSR cookie synchronization still works end-to-end (login, callback, protected API).
- [x] Re-run API/auth tests and smoke test `/today`, `/api/session/today`, `/api/session/start`.
- [ ] Monitor for regressions in rate limiting and security headers after migration.
