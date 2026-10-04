-- Million Deal subscribers schema (run in Supabase SQL editor)
create table if not exists public.subscribers (
  email text primary key,
  is_paid boolean not null default false,
  subscription_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;

create policy "subscribers read own"
  on public.subscribers for select
  using (auth.jwt() ->> 'email' = email);

create policy "service role full"
  on public.subscribers for all
  using (auth.role() = 'service_role');
