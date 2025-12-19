-- 04_chunks.sql
create table if not exists public.chunks (
  id serial primary key,
  summary_id integer not null references public.summaries(id) on delete cascade,
  summary text,
  action_items text[],
  key_points text[],
  notable_quotes text[],
  start_time integer,
  end_time integer
);

create index if not exists idx_chunks_summary_id on public.chunks(summary_id);

alter table public.chunks enable row level security;
create policy "chunks: owner via summary->user" on public.chunks
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
