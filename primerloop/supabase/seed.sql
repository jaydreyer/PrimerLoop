insert into subjects (slug, name)
values ('ai-llm-systems', 'AI & LLM Systems')
on conflict (slug) do nothing;

-- Seed concepts intentionally omitted here.
-- Load curriculum bundles separately so architecture stays multi-subject.
