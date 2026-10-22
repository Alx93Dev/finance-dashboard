-- Run once in the Supabase SQL editor to create the table cloud sync uses.
-- Each user has a single row with all of their data, the same JSON as a backup file.

create table if not exists public.snapshots (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null
);

alter table public.snapshots enable row level security;

create policy "Users read their own data" on public.snapshots
  for select using (auth.uid() = user_id);

create policy "Users create their own data" on public.snapshots
  for insert with check (auth.uid() = user_id);

create policy "Users update their own data" on public.snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete their own data" on public.snapshots
  for delete using (auth.uid() = user_id);
