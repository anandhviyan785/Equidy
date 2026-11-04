-- Equidy database schema for Supabase.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to run again; it only creates what is missing.
--
-- Row-level security is switched on with no policies, so these tables are reachable only with the
-- service-role (secret) key that the Equidy server holds — never with the public anon key.

-- Portfolio, watchlist, conversations and settings for each signed-in user.
create table if not exists public.equidy_user_data (
  user_id text primary key,
  portfolio jsonb not null default '{}'::jsonb,
  chats jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.equidy_user_data enable row level security;

-- Plaid bank connections. Access tokens are encrypted by the server (AES-256-GCM) before storage.
create table if not exists public.equidy_plaid_items (
  item_id text primary key,
  user_id text not null,
  access_token_enc text not null,
  institution_name text,
  created_at timestamptz not null default now()
);
create index if not exists equidy_plaid_items_user_id_idx on public.equidy_plaid_items (user_id);
alter table public.equidy_plaid_items enable row level security;

-- Shared cache for market data and intelligence, so the Alpha Vantage free quota (25 calls a day)
-- is shared across server instances instead of spent by each one.
create table if not exists public.equidy_market_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.equidy_market_cache enable row level security;

-- Deleting a Supabase user also removes their Equidy data.
create or replace function public.equidy_delete_user_data() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.equidy_user_data where user_id = 'sb:' || old.id::text;
  delete from public.equidy_plaid_items where user_id = 'sb:' || old.id::text;
  return old;
end;
$$;

drop trigger if exists equidy_on_auth_user_deleted on auth.users;
create trigger equidy_on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.equidy_delete_user_data();
