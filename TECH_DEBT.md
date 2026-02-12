# Tech Debt Log

## Next.js 16 middleware deprecation (`middleware.ts` -> `proxy.ts`)

- Status: Open
- Priority: Medium
- Owner: Unassigned
- First observed: 2026-02-12

### Current behavior

- The app uses root `middleware.ts` to:
  - refresh Supabase SSR auth cookies (`createServerClient(...); await supabase.auth.getUser()`),
  - apply security headers,
  - enforce a basic in-memory rate limit for `/api/*`.
- On Next.js 16, this convention is deprecated in favor of `proxy.ts`/`export function proxy()`.
- Current behavior still works, but emits deprecation guidance and should be migrated before removal in a future Next major.

### References

- Next.js v16 upgrade guide (`middleware` to `proxy`): https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js message: Renaming Middleware to Proxy: https://nextjs.org/docs/messages/middleware-to-proxy
- Next.js proxy file convention docs: https://nextjs.org/docs/app/api-reference/file-conventions/middleware
- Supabase Auth + Next.js (SSR/App Router): https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase `@supabase/ssr` migration guidance: https://supabase.com/docs/guides/auth/auth-helpers/nextjs-pages

### Migration plan (placeholder)

- [ ] Confirm target runtime behavior for auth refresh, security headers, and rate limiting under `proxy.ts`.
- [ ] Run codemod (`middleware-to-proxy`) in a dedicated branch and review generated changes.
- [ ] Rename file/function: `middleware.ts` -> `proxy.ts`, `middleware()` -> `proxy()`.
- [ ] Verify Supabase SSR cookie synchronization still works end-to-end (login, callback, protected API).
- [ ] Re-run API/auth tests and smoke test `/today`, `/api/session/today`, `/api/session/start`.
- [ ] Monitor for regressions in rate limiting and security headers after migration.
