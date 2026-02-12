create extension if not exists "pgcrypto";

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  track text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now()
);

create table if not exists concept_prerequisites (
  concept_id uuid not null references concepts(id) on delete cascade,
  prerequisite_concept_id uuid not null references concepts(id) on delete cascade,
  primary key (concept_id, prerequisite_concept_id)
);

create table if not exists user_concepts (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  mastery_level int not null default 0 check (mastery_level between 0 and 3),
  next_due_at timestamptz,
  seen_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  daily_minutes int not null default 12 check (daily_minutes between 10 and 15),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  concept_id uuid references concepts(id) on delete set null,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  session_date date not null,
  duration_target_minutes int not null default 12,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists session_concepts (
  session_id uuid not null references sessions(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  kind text not null check (kind in ('new', 'review')),
  question_count int not null check (question_count > 0),
  primary key (session_id, concept_id)
);

-- Deprecated for MVP persistence. Kept as reserved schema for potential
-- per-question history/event logging in a future iteration.
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score_total numeric(6,3) not null,
  score_max numeric(6,3) not null,
  percent numeric(5,2) not null,
  answers jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  score_total numeric(6,3) not null,
  score_max numeric(6,3) not null,
  percent numeric(5,2) not null,
  answers jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists notebook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  body_md text not null,
  created_at timestamptz not null default now()
);

-- LLM output caching for cost control
create table if not exists generated_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('lesson', 'quiz', 'notebook_template')),
  subject_id uuid references subjects(id) on delete cascade,
  concept_id uuid references concepts(id) on delete cascade,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  version int not null default 1 check (version > 0),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (asset_type in ('lesson', 'quiz') and subject_id is not null and concept_id is not null and difficulty is not null)
    or
    (asset_type = 'notebook_template' and subject_id is not null)
  ),
  unique (asset_type, subject_id, concept_id, difficulty, version)
);

create unique index if not exists uq_notebook_template_subject_version
on generated_assets (subject_id, version)
where asset_type = 'notebook_template';
