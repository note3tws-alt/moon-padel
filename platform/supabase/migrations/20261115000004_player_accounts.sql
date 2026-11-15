-- MoonPadel: player accounts.
--
-- Players sign in with Supabase Auth (Google or an email link). A sign-in is
-- only connected to a player profile in one of two safe ways:
--   * email match: an admin already stored this exact email on the player
--     (player_private.email) and Supabase has verified the address, or
--   * admin approval: the player asks to claim a profile and an admin approves.
-- Nobody can attach themselves to someone else's profile.
--
-- Both tables are private. The Next.js server reads them over the direct
-- database connection; the public API (anon key, or a signed-in player's
-- token) cannot read or write them. Only admins listed in public.users can.

create table if not exists public.player_accounts (
  auth_user_id uuid primary key,              -- auth.users.id
  player_id uuid not null unique references public.players(id) on delete cascade,
  email citext,
  linked_via text not null check (linked_via in ('email_match', 'admin_approved')),
  linked_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.player_claims (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,                 -- auth.users.id
  email citext,
  player_id uuid references public.players(id) on delete cascade,  -- null = "I am not on the list yet"
  requested_name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (player_id is not null or requested_name is not null)
);
create unique index if not exists player_claims_one_pending on public.player_claims(auth_user_id) where status = 'pending';
create index if not exists player_claims_status_idx on public.player_claims(status, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['player_accounts', 'player_claims'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- No public_read policy on purpose: emails and claims are never public.
