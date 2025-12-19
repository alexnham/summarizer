-- 01_profiles.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email citext unique,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles: owner can manage own profile" on public.profiles
  for all
  using ( auth.uid()::uuid = id )
  with check ( auth.uid()::uuid = id );
