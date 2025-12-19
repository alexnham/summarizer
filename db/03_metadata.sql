-- 03_metadata.sql
create table if not exists public.metadata (
  id serial primary key,
  summary_id integer not null unique references public.summaries(id) on delete cascade,
  duration integer,
  chunk_minutes integer,
  chunks_count integer
);

alter table public.metadata enable row level security;
create policy "metadata: owner via summary->user" on public.metadata
  for all
  using (
    exists (
      select 1 from public.summaries s where s.id = summary_id and s.user_id = auth.uid()::uuid
    )
  )
  with check (
    exists (
      select 1 from public.summaries s where s.id = summary_id and s.user_id = auth.uid()::uuid
    )
  );
