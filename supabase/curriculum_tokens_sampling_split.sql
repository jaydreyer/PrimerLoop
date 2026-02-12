-- Curriculum split for AI & LLM Systems:
-- "LLM Basics: Tokens, Context, and Sampling" -> "Tokens & Context"
-- plus new "Sampling & Generation Behavior" concept.
--
-- Idempotent: safe to run multiple times.
-- Existing sessions are preserved because this updates concept metadata in place
-- when possible and does not modify session rows.

do $$
declare
  v_subject_id uuid;
  v_tokens_concept_id uuid;
  v_legacy_concept_id uuid;
  v_tokens_track text;
begin
  select id
  into v_subject_id
  from subjects
  where slug = 'ai-llm-systems'
  limit 1;

  if v_subject_id is null then
    raise notice 'ai-llm-systems subject not found; skipping curriculum split';
    return;
  end if;

  -- Locate target concept if already renamed.
  select id, track
  into v_tokens_concept_id, v_tokens_track
  from concepts
  where subject_id = v_subject_id
    and slug = 'tokens-context'
  order by created_at asc
  limit 1;

  -- Locate legacy concept by old title/slug.
  select id
  into v_legacy_concept_id
  from concepts
  where subject_id = v_subject_id
    and (
      title = 'LLM Basics: Tokens, Context, and Sampling'
      or slug = 'llm-basics-tokens-context-and-sampling'
    )
  order by created_at asc
  limit 1;

  -- Rename legacy in place when target slug does not already exist.
  if v_tokens_concept_id is null and v_legacy_concept_id is not null then
    update concepts
    set
      title = 'Tokens & Context',
      slug = 'tokens-context'
    where id = v_legacy_concept_id;

    v_tokens_concept_id := v_legacy_concept_id;
  end if;

  -- If neither target nor legacy exists, create tokens-context.
  if v_tokens_concept_id is null then
    insert into concepts (subject_id, slug, title, track, difficulty, description)
    values (
      v_subject_id,
      'tokens-context',
      'Tokens & Context',
      'LLM_APP',
      'beginner',
      'Tokenization, context windows, truncation, and token-cost budgeting.'
    )
    returning id, track
    into v_tokens_concept_id, v_tokens_track;
  end if;

  -- Refresh track from canonical tokens-context concept.
  if v_tokens_track is null then
    select track
    into v_tokens_track
    from concepts
    where id = v_tokens_concept_id;
  end if;

  -- Insert the new follow-up concept.
  insert into concepts (subject_id, slug, title, track, difficulty, description)
  select
    v_subject_id,
    'sampling-generation',
    'Sampling & Generation Behavior',
    coalesce(v_tokens_track, 'LLM_APP'),
    'beginner',
    'Next-token prediction, greedy decoding, temperature, top-p, and determinism vs randomness.'
  where not exists (
    select 1
    from concepts
    where subject_id = v_subject_id
      and slug = 'sampling-generation'
  );

  -- Ensure sequence via prerequisites: sampling-generation comes after tokens-context.
  insert into concept_prerequisites (concept_id, prerequisite_concept_id)
  select
    sampling.id,
    tokens.id
  from concepts sampling
  join concepts tokens
    on sampling.subject_id = tokens.subject_id
  where sampling.subject_id = v_subject_id
    and sampling.slug = 'sampling-generation'
    and tokens.slug = 'tokens-context'
  on conflict (concept_id, prerequisite_concept_id) do nothing;
end $$;
