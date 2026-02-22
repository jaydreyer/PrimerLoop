-- Canonical slug migration draft (second pass: many-to-one merges)
-- Date: 2026-02-21
--
-- Purpose:
--   Merge unresolved many-to-one legacy slug groups after first-pass safe renames.
--
-- Safety:
--   - Dry run by default (ROLLBACK at bottom).
--   - Survivor concept selection prefers an existing canonical target slug, otherwise
--     earliest created_at source concept (then concept_id).
--   - Foreign key references are remapped before loser concepts are deleted.

begin;

create temp table _merge_group (
  target_slug text not null,
  source_slug text not null,
  primary key (target_slug, source_slug)
) on commit drop;

insert into _merge_group (target_slug, source_slug)
values
  ('what-is-an-llm', 'submit-flow'),
  ('what-is-an-llm', 'llm-what-is'),
  ('context-window', 'context-windows'),
  ('context-window', 'why-limits'),
  ('context-window', 'context-window-strategies'),
  ('sampling', 'sampling-basics'),
  ('sampling', 'sampling-generation'),
  ('tokens', 'tokens-basics'),
  ('tokens', 'tokens-context'),
  ('rag', 'rag-basics'),
  ('rag', 'retrieval-augmented-generation'),
  ('llm-production-architecture', 'structured-output'),
  ('llm-production-architecture', 'production-observability');

create temp table _merge_candidates on commit drop as
select
  g.target_slug,
  g.source_slug,
  c.id as concept_id,
  c.created_at
from _merge_group g
left join concepts c
  on c.slug = g.source_slug;

-- Preflight A: expected source slugs that are missing from concepts.
select
  target_slug,
  source_slug
from _merge_candidates
where concept_id is null
order by target_slug, source_slug;

create temp table _merge_targets_with_sources on commit drop as
select distinct target_slug
from _merge_candidates
where concept_id is not null;

create temp table _merge_existing_targets on commit drop as
select
  t.target_slug,
  c.id as concept_id,
  c.created_at
from _merge_targets_with_sources t
join concepts c
  on c.slug = t.target_slug;

-- Preflight B: canonical target rows already present.
select
  target_slug,
  concept_id as existing_target_concept_id
from _merge_existing_targets
order by target_slug, concept_id;

create temp table _merge_survivors on commit drop as
select distinct on (target_slug)
  target_slug,
  concept_id as survivor_id
from (
  select
    target_slug,
    concept_id,
    created_at,
    0 as survivor_priority
  from _merge_existing_targets
  union all
  select
    target_slug,
    concept_id,
    created_at,
    1 as survivor_priority
  from _merge_candidates
  where concept_id is not null
) survivor_pool
order by
  target_slug,
  survivor_priority asc,
  created_at asc nulls last,
  concept_id;

create temp table _merge_map on commit drop as
select
  c.target_slug,
  c.concept_id as loser_id,
  s.survivor_id
from _merge_candidates c
join _merge_survivors s
  on s.target_slug = c.target_slug
where c.concept_id is not null
  and c.concept_id <> s.survivor_id;

create temp table _affected_concepts on commit drop as
select survivor_id as concept_id from _merge_survivors
union
select loser_id as concept_id from _merge_map;

-- Preflight C: survivor/loser plan
select
  s.target_slug,
  s.survivor_id,
  array_agg(m.loser_id order by m.loser_id) as loser_ids
from _merge_survivors s
left join _merge_map m
  on m.target_slug = s.target_slug
group by s.target_slug, s.survivor_id
order by s.target_slug;

-- 1) concept_prerequisites: remap both columns, dedupe by PK.
insert into concept_prerequisites (concept_id, prerequisite_concept_id)
select distinct
  coalesce(m1.survivor_id, cp.concept_id) as concept_id,
  coalesce(m2.survivor_id, cp.prerequisite_concept_id) as prerequisite_concept_id
from concept_prerequisites cp
left join _merge_map m1
  on m1.loser_id = cp.concept_id
left join _merge_map m2
  on m2.loser_id = cp.prerequisite_concept_id
where (
  cp.concept_id in (select concept_id from _affected_concepts)
   or cp.prerequisite_concept_id in (select concept_id from _affected_concepts)
)
  and coalesce(m1.survivor_id, cp.concept_id) <> coalesce(m2.survivor_id, cp.prerequisite_concept_id)
on conflict (concept_id, prerequisite_concept_id) do nothing;

delete from concept_prerequisites
where concept_id in (select loser_id from _merge_map)
   or prerequisite_concept_id in (select loser_id from _merge_map);

-- 2) user_concepts: merge loser/survivor rows.
with remapped as (
  select
    uc.user_id,
    coalesce(m.survivor_id, uc.concept_id) as concept_id,
    uc.mastery_level,
    uc.next_due_at,
    uc.seen_count,
    uc.updated_at
  from user_concepts uc
  left join _merge_map m
    on m.loser_id = uc.concept_id
  where uc.concept_id in (select concept_id from _affected_concepts)
),
aggregated as (
  select
    user_id,
    concept_id,
    max(mastery_level) as mastery_level,
    min(next_due_at) filter (where next_due_at is not null) as next_due_at,
    sum(seen_count) as seen_count,
    max(updated_at) as updated_at
  from remapped
  group by user_id, concept_id
)
insert into user_concepts (user_id, concept_id, mastery_level, next_due_at, seen_count, updated_at)
select user_id, concept_id, mastery_level, next_due_at, seen_count, updated_at
from aggregated
on conflict (user_id, concept_id) do update
set
  mastery_level = greatest(user_concepts.mastery_level, excluded.mastery_level),
  next_due_at = case
    when user_concepts.next_due_at is null then excluded.next_due_at
    when excluded.next_due_at is null then user_concepts.next_due_at
    else least(user_concepts.next_due_at, excluded.next_due_at)
  end,
  seen_count = greatest(user_concepts.seen_count, excluded.seen_count),
  updated_at = greatest(user_concepts.updated_at, excluded.updated_at);

delete from user_concepts
where concept_id in (select loser_id from _merge_map);

-- 3) user_concept_mastery: merge loser/survivor rows.
with remapped as (
  select
    ucm.user_id,
    ucm.subject_id,
    coalesce(m.survivor_id, ucm.concept_id) as concept_id,
    ucm.mastery_score,
    ucm.review_count,
    ucm.last_attempt_at,
    ucm.next_review_at,
    ucm.updated_at
  from user_concept_mastery ucm
  left join _merge_map m
    on m.loser_id = ucm.concept_id
  where ucm.concept_id in (select concept_id from _affected_concepts)
),
aggregated as (
  select
    user_id,
    subject_id,
    concept_id,
    max(mastery_score) as mastery_score,
    sum(review_count) as review_count,
    max(last_attempt_at) as last_attempt_at,
    min(next_review_at) filter (where next_review_at is not null) as next_review_at,
    max(updated_at) as updated_at
  from remapped
  group by user_id, subject_id, concept_id
)
insert into user_concept_mastery (
  user_id,
  subject_id,
  concept_id,
  mastery_score,
  review_count,
  last_attempt_at,
  next_review_at,
  updated_at
)
select
  user_id,
  subject_id,
  concept_id,
  mastery_score,
  review_count,
  last_attempt_at,
  next_review_at,
  updated_at
from aggregated
on conflict (user_id, subject_id, concept_id) do update
set
  mastery_score = greatest(user_concept_mastery.mastery_score, excluded.mastery_score),
  review_count = greatest(user_concept_mastery.review_count, excluded.review_count),
  last_attempt_at = case
    when user_concept_mastery.last_attempt_at is null then excluded.last_attempt_at
    when excluded.last_attempt_at is null then user_concept_mastery.last_attempt_at
    else greatest(user_concept_mastery.last_attempt_at, excluded.last_attempt_at)
  end,
  next_review_at = case
    when user_concept_mastery.next_review_at is null then excluded.next_review_at
    when excluded.next_review_at is null then user_concept_mastery.next_review_at
    else least(user_concept_mastery.next_review_at, excluded.next_review_at)
  end,
  updated_at = greatest(user_concept_mastery.updated_at, excluded.updated_at);

delete from user_concept_mastery
where concept_id in (select loser_id from _merge_map);

-- 4) sessions: direct FK remap.
update sessions s
set concept_id = m.survivor_id
from _merge_map m
where s.concept_id = m.loser_id;

-- 5) session_concepts: remap and dedupe by PK.
with remapped as (
  select
    sc.session_id,
    coalesce(m.survivor_id, sc.concept_id) as concept_id,
    sc.kind,
    sc.question_count
  from session_concepts sc
  left join _merge_map m
    on m.loser_id = sc.concept_id
  where sc.concept_id in (select concept_id from _affected_concepts)
),
aggregated as (
  select
    session_id,
    concept_id,
    case
      when bool_or(kind = 'review') then 'review'
      else 'new'
    end as kind,
    max(question_count) as question_count
  from remapped
  group by session_id, concept_id
)
insert into session_concepts (session_id, concept_id, kind, question_count)
select session_id, concept_id, kind, question_count
from aggregated
on conflict (session_id, concept_id) do update
set
  kind = excluded.kind,
  question_count = greatest(session_concepts.question_count, excluded.question_count);

delete from session_concepts
where concept_id in (select loser_id from _merge_map);

-- 6) quiz_submissions: direct FK remap.
update quiz_submissions qs
set concept_id = m.survivor_id
from _merge_map m
where qs.concept_id = m.loser_id;

-- 7) notebook_entries: direct FK remap.
update notebook_entries ne
set concept_id = m.survivor_id
from _merge_map m
where ne.concept_id = m.loser_id;

-- 8) user_notebook_entries: remap and dedupe by PK.
with remapped as (
  select
    une.user_id,
    coalesce(m.survivor_id, une.concept_id) as concept_id,
    une.version,
    une.content,
    une.created_at,
    une.updated_at
  from user_notebook_entries une
  left join _merge_map m
    on m.loser_id = une.concept_id
  where une.concept_id in (select concept_id from _affected_concepts)
),
aggregated as (
  select
    user_id,
    concept_id,
    version,
    (array_agg(content order by updated_at desc, created_at desc))[1] as content,
    min(created_at) as created_at,
    max(updated_at) as updated_at
  from remapped
  group by user_id, concept_id, version
)
insert into user_notebook_entries (
  user_id,
  concept_id,
  version,
  content,
  created_at,
  updated_at
)
select
  user_id,
  concept_id,
  version,
  content,
  created_at,
  updated_at
from aggregated
on conflict (user_id, concept_id, version) do update
set
  content = excluded.content,
  created_at = least(user_notebook_entries.created_at, excluded.created_at),
  updated_at = greatest(user_notebook_entries.updated_at, excluded.updated_at);

delete from user_notebook_entries
where concept_id in (select loser_id from _merge_map);

-- 9) generated_assets (lesson/quiz rows): remap and dedupe by unique key.
with remapped as (
  select
    ga.asset_type,
    ga.subject_id,
    coalesce(m.survivor_id, ga.concept_id) as concept_id,
    ga.difficulty,
    ga.version,
    ga.content,
    ga.created_at,
    ga.updated_at
  from generated_assets ga
  left join _merge_map m
    on m.loser_id = ga.concept_id
  where ga.concept_id in (select concept_id from _affected_concepts)
),
aggregated as (
  select
    asset_type,
    subject_id,
    concept_id,
    difficulty,
    version,
    (array_agg(content order by updated_at desc, created_at desc))[1] as content,
    min(created_at) as created_at,
    max(updated_at) as updated_at
  from remapped
  group by asset_type, subject_id, concept_id, difficulty, version
)
insert into generated_assets (
  asset_type,
  subject_id,
  concept_id,
  difficulty,
  version,
  content,
  created_at,
  updated_at
)
select
  asset_type,
  subject_id,
  concept_id,
  difficulty,
  version,
  content,
  created_at,
  updated_at
from aggregated
on conflict (asset_type, subject_id, concept_id, difficulty, version) do update
set
  content = excluded.content,
  created_at = least(generated_assets.created_at, excluded.created_at),
  updated_at = greatest(generated_assets.updated_at, excluded.updated_at);

delete from generated_assets
where concept_id in (select loser_id from _merge_map);

-- 10) Rename survivors to canonical target slugs.
update concepts c
set slug = s.target_slug
from _merge_survivors s
where c.id = s.survivor_id
  and c.slug <> s.target_slug;

-- 11) Delete loser concepts after all FK remaps.
delete from concepts
where id in (select loser_id from _merge_map);

-- Post-check: there should be no unresolved source slugs left.
select
  g.target_slug,
  g.source_slug
from _merge_group g
join concepts c
  on c.slug = g.source_slug
order by g.target_slug, g.source_slug;

-- Post-check: canonical target slugs present.
select
  s.target_slug,
  s.survivor_id
from _merge_survivors s
join concepts c
  on c.id = s.survivor_id
 and c.slug = s.target_slug
order by s.target_slug;

-- Dry run by default.
rollback;
-- commit;
