# Canonical Slug Migration Runbook

Date: 2026-02-21

Purpose:
- Move from legacy concept slugs to curated canonical slugs with minimal risk.
- Execute in two phases:
1. Safe one-to-one renames.
2. Many-to-one merges with FK remapping.

Files:
- Pass 1 draft: `supabase/canonical_slug_migration_draft.sql`
- Pass 2 draft: `supabase/canonical_slug_merge_pass2_draft.sql`
- Alias source of truth: `config/content-slug-aliases.json`
- Coverage check: `scripts/audit-content-slugs.mjs`

## 0) Preconditions

1. Ensure application code from branch `codex/session-stability-foundation` is deployed in the environment where migration will run.
2. Ensure no schema drift from `supabase/schema.sql` for these tables:
- `concepts`
- `concept_prerequisites`
- `user_concepts`
- `user_concept_mastery`
- `sessions`
- `session_concepts`
- `quiz_submissions`
- `notebook_entries`
- `user_notebook_entries`
- `generated_assets`
3. Take a DB backup/snapshot.
4. Run local slug audit and confirm pass:
```bash
npm run audit:content-slugs
```

## 1) Phase 1 (safe one-to-one rename pass)

1. Open `supabase/canonical_slug_migration_draft.sql` in Supabase SQL editor.
2. Run exactly as-is (dry run; ends with `rollback;`).
3. Review result sets:
- Missing source slugs should be expected/understood.
- Target collisions should be expected/understood.
- Many-to-one groups should be non-empty (these are for phase 2).
- Returned renamed rows show what would be changed in safe pass.
4. If output looks correct, switch bottom lines:
- change `rollback;` to `-- rollback;`
- change `-- commit;` to `commit;`
5. Execute again to apply phase 1.

## 2) Phase 2 (many-to-one merge pass)

1. Open `supabase/canonical_slug_merge_pass2_draft.sql`.
2. Run exactly as-is (dry run; ends with `rollback;`).
3. Review result sets:
- Preflight A (missing source rows) should be empty or expected.
- Preflight B should clearly show survivor + loser IDs per target slug.
- Post-check unresolved source slugs should be empty in a commit scenario.
4. If dry-run outputs are correct, switch bottom lines:
- change `rollback;` to `-- rollback;`
- change `-- commit;` to `commit;`
5. Execute again to apply phase 2.

## 3) Post-migration validation SQL

Run these queries after phase 2 commit:

```sql
-- 1) No legacy source slugs remain
with legacy as (
  values
    ('submit-flow'), ('llm-what-is'), ('tokens-basics'), ('context-windows'),
    ('why-limits'), ('sampling-basics'), ('embeddings-basics'), ('vector-db-basics'),
    ('rag-basics'), ('tokens-context'), ('sampling-generation'), ('prompting-basics'),
    ('structured-output'), ('context-window-strategies'), ('retrieval-augmented-generation'),
    ('evaluation-basics'), ('caching-latency-cost'), ('tool-calling-basics'),
    ('agent-loops-safety'), ('prompt-injection-defense'), ('production-observability')
)
select c.id, c.slug
from concepts c
join legacy l(slug)
  on c.slug = l.slug;
```

```sql
-- 2) Canonical targets exist
with canonical as (
  values
    ('what-is-an-llm'), ('tokens'), ('context-window'), ('sampling'),
    ('embeddings'), ('vector-databases'), ('rag'), ('prompt-engineering'),
    ('llm-production-architecture'), ('llm-evaluation-and-metrics'),
    ('model-efficiency-and-cost-engineering'), ('agent-architectures-and-tool-use'),
    ('alignment-and-safety-at-scale'), ('prompt-injection-and-security')
)
select slug
from canonical c(slug)
left join concepts k
  on k.slug = c.slug
where k.id is null;
```

```sql
-- 3) No dangling concept references (sanity)
select 'sessions' as table_name, count(*) as dangling_rows
from sessions s
left join concepts c on c.id = s.concept_id
where s.concept_id is not null and c.id is null
union all
select 'session_concepts', count(*)
from session_concepts sc
left join concepts c on c.id = sc.concept_id
where c.id is null
union all
select 'user_concepts', count(*)
from user_concepts uc
left join concepts c on c.id = uc.concept_id
where c.id is null
union all
select 'user_concept_mastery', count(*)
from user_concept_mastery ucm
left join concepts c on c.id = ucm.concept_id
where c.id is null
union all
select 'quiz_submissions', count(*)
from quiz_submissions qs
left join concepts c on c.id = qs.concept_id
where c.id is null
union all
select 'notebook_entries', count(*)
from notebook_entries ne
left join concepts c on c.id = ne.concept_id
where c.id is null
union all
select 'user_notebook_entries', count(*)
from user_notebook_entries une
left join concepts c on c.id = une.concept_id
where c.id is null
union all
select 'generated_assets', count(*)
from generated_assets ga
left join concepts c on c.id = ga.concept_id
where ga.concept_id is not null and c.id is null;
```

Expected: all counts should be `0`, and validation queries should return empty result sets.

## 4) Application verification

After DB migration, run:
```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run audit:content-slugs
```

Also verify in app:
1. `/today` renders concept titles normally (no reset-needed metadata issues).
2. `/lesson/[sessionId]` serves curated lesson content for migrated concepts.
3. `/quiz/[sessionId]` serves curated quiz content for migrated concepts.
4. `/notebook/[conceptId]` still generates/reads entries for existing users.

## 5) Rollback strategy

If any phase fails during commit:
1. Stop further migration steps.
2. Restore from DB snapshot/backup.
3. Re-run phase in dry-run mode and inspect preflight outputs.
4. Patch draft SQL before retrying commit.
