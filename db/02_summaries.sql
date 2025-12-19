-- 02_summaries.sql
create table if not exists public.summaries (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content text,
  final_summary text,
  transcript text,
  created_at timestamptz default now()
);

create index if not exists idx_summaries_user_id on public.summaries(user_id);

alter table public.summaries enable row level security;
create policy "summaries: owner can select/insert/update/delete" on public.summaries
  for all
  using ( auth.uid()::uuid = user_id )
  with check ( auth.uid()::uuid = user_id );
