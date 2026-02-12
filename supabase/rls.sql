alter table subjects enable row level security;
alter table concepts enable row level security;
alter table concept_prerequisites enable row level security;
alter table user_concepts enable row level security;
alter table user_settings enable row level security;
alter table sessions enable row level security;
alter table session_concepts enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_submissions enable row level security;
alter table notebook_entries enable row level security;
alter table generated_assets enable row level security;

drop policy if exists "subjects_read_only" on subjects;
drop policy if exists "subjects_public_read" on subjects;
create policy "subjects_public_read" on subjects
for select using (true);

drop policy if exists "concepts_read_only" on concepts;
drop policy if exists "concepts_public_read" on concepts;
create policy "concepts_public_read" on concepts
for select using (true);

drop policy if exists "concept_prerequisites_read_only" on concept_prerequisites;
drop policy if exists "concept_prerequisites_public_read" on concept_prerequisites;
create policy "concept_prerequisites_public_read" on concept_prerequisites
for select using (true);

drop policy if exists "user_concepts_owner" on user_concepts;
create policy "user_concepts_owner"
  on user_concepts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_owner" on user_settings;
create policy "user_settings_owner"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sessions_owner" on sessions;
create policy "sessions_owner"
  on sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "session_concepts_owner" on session_concepts;
create policy "session_concepts_owner"
  on session_concepts for all
  using (
    exists (
      select 1
      from sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

-- quiz_attempts is deprecated for current UI flow. Keep table inaccessible
-- by default under RLS (no active client policies).
drop policy if exists "quiz_attempts_owner" on quiz_attempts;
drop policy if exists "quiz_attempts_select_owner" on quiz_attempts;
drop policy if exists "quiz_attempts_insert_owner" on quiz_attempts;
drop policy if exists "quiz_attempts_update_owner" on quiz_attempts;
drop policy if exists "quiz_attempts_delete_owner" on quiz_attempts;

drop policy if exists "quiz_submissions_owner" on quiz_submissions;
drop policy if exists "quiz_submissions_select_owner" on quiz_submissions;
drop policy if exists "quiz_submissions_insert_owner" on quiz_submissions;

create policy "quiz_submissions_select_owner"
  on quiz_submissions for select
  using (auth.uid() = user_id);

create policy "quiz_submissions_insert_owner"
  on quiz_submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "notebook_entries_owner" on notebook_entries;
create policy "notebook_entries_owner"
  on notebook_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- GENERATED_ASSETS
alter table generated_assets enable row level security;

-- Remove any prior policies (optional but helps avoid confusion)
drop policy if exists "generated_assets_select_auth" on generated_assets;
drop policy if exists "generated_assets_no_insert" on generated_assets;
drop policy if exists "generated_assets_no_update" on generated_assets;
drop policy if exists "generated_assets_no_delete" on generated_assets;
drop policy if exists "generated_assets_authenticated_read" on generated_assets;

-- Allow SELECT only for authenticated users
create policy "generated_assets_select_auth"
on generated_assets
for select
using (auth.uid() is not null);

-- Explicitly block writes from client roles (anon/authenticated)
-- (Service role bypasses RLS so it can still write from server)
create policy "generated_assets_no_insert"
on generated_assets
for insert
with check (false);

create policy "generated_assets_no_update"
on generated_assets
for update
using (false)
with check (false);

create policy "generated_assets_no_delete"
on generated_assets
for delete
using (false);
