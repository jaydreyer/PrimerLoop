-- Canonical slug migration draft (first pass)
-- Date: 2026-02-21
--
-- Goal:
--   1) Apply safe one-to-one slug renames from legacy seed slugs to curated canonical slugs.
--   2) Report many-to-one mappings that require data merge decisions.
--
-- Notes:
--   - This draft is intentionally conservative. It does NOT auto-merge multiple concepts into one.
--   - Keep this as a dry run initially (ROLLBACK at bottom). Switch to COMMIT once reviewed.

begin;

create temp table _slug_alias_map (
  source_slug text primary key,
  target_slug text not null
) on commit drop;

insert into _slug_alias_map (source_slug, target_slug)
values
  ('submit-flow', 'what-is-an-llm'),
  ('llm-what-is', 'what-is-an-llm'),
  ('tokens-basics', 'tokens'),
  ('context-windows', 'context-window'),
  ('why-limits', 'context-window'),
  ('sampling-basics', 'sampling'),
  ('embeddings-basics', 'embeddings'),
  ('vector-db-basics', 'vector-databases'),
  ('rag-basics', 'rag'),
  ('tokens-context', 'tokens'),
  ('sampling-generation', 'sampling'),
  ('prompting-basics', 'prompt-engineering'),
  ('structured-output', 'llm-production-architecture'),
  ('context-window-strategies', 'context-window'),
  ('retrieval-augmented-generation', 'rag'),
  ('evaluation-basics', 'llm-evaluation-and-metrics'),
  ('caching-latency-cost', 'model-efficiency-and-cost-engineering'),
  ('tool-calling-basics', 'agent-architectures-and-tool-use'),
  ('agent-loops-safety', 'alignment-and-safety-at-scale'),
  ('prompt-injection-defense', 'prompt-injection-and-security'),
  ('production-observability', 'llm-production-architecture');

-- Preflight A: alias sources missing from concepts table.
select
  a.source_slug
from _slug_alias_map a
left join concepts c
  on c.slug = a.source_slug
where c.id is null
order by a.source_slug;

-- Preflight B: alias targets already present in concepts table.
-- If present and different concept IDs exist, review carefully before any rename.
select
  a.target_slug,
  c.id as existing_target_concept_id
from _slug_alias_map a
join concepts c
  on c.slug = a.target_slug
order by a.target_slug, c.id;

-- Preflight C: many-to-one groups (legacy slugs mapping to same target).
select
  a.target_slug,
  array_agg(a.source_slug order by a.source_slug) as source_slugs,
  count(*) as source_slug_count
from _slug_alias_map a
group by a.target_slug
having count(*) > 1
order by a.target_slug;

-- Safe pass: apply only one-to-one renames where target is not already used by another concept.
with target_counts as (
  select
    target_slug,
    count(*) as source_count
  from _slug_alias_map
  group by target_slug
),
one_to_one as (
  select
    a.source_slug,
    a.target_slug
  from _slug_alias_map a
  join target_counts t
    on t.target_slug = a.target_slug
  where t.source_count = 1
),
eligible as (
  select
    c.id as concept_id,
    o.source_slug,
    o.target_slug
  from one_to_one o
  join concepts c
    on c.slug = o.source_slug
  left join concepts existing_target
    on existing_target.slug = o.target_slug
  where existing_target.id is null
     or existing_target.id = c.id
)
update concepts c
set slug = e.target_slug
from eligible e
where c.id = e.concept_id
returning
  e.source_slug as renamed_from,
  e.target_slug as renamed_to,
  c.id as concept_id;

-- Post-safe-pass: unresolved alias rows.
-- These require manual merge work (multiple legacy concepts targeting one canonical slug).
with alias_sources as (
  select
    a.source_slug,
    a.target_slug,
    c.id as concept_id
  from _slug_alias_map a
  left join concepts c
    on c.slug = a.source_slug
),
remaining as (
  select
    source_slug,
    target_slug,
    concept_id
  from alias_sources
  where concept_id is not null
)
select
  target_slug,
  array_agg(format('%s (%s)', source_slug, concept_id) order by source_slug) as source_concepts
from remaining
group by target_slug
having count(*) > 1
order by target_slug;

-- Suggested next step for unresolved groups:
--   1) Choose survivor concept_id per target_slug.
--   2) Move foreign key references from loser concept_ids -> survivor concept_id.
--   3) Rename survivor slug to target_slug.
--   4) Delete loser concepts.

-- Dry run by default.
rollback;
-- commit;
