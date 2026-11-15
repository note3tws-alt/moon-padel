-- MoonPadel: row level security.
--
-- The Next.js server talks to Postgres directly with the service connection
-- (DATABASE_URL), which bypasses RLS, and enforces admin access itself.
-- These policies protect the same tables from anyone using the public anon key
-- through the Supabase REST API:
--   * public league data is read-only for everyone
--   * contact details, users, logs and settings drafts are never public
--   * writes need an authenticated user listed in public.users

-- Supabase provides auth.uid(). For plain Postgres, scripts/local-auth-shim.sql
-- creates a stub that returns null so these policies still compile.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.users u where u.id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','divisions','clubs','players','player_private','player_division_history',
    'pairs','pair_members','tournaments','tournament_registrations','matches','match_players',
    'rating_adjustments','historical_monthly_stats','player_rating_history','tournament_points',
    'monthly_rankings','player_stats','pair_stats','scoring_settings','site_settings',
    'import_logs','admin_audit_logs','recalc_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- Public, read-only league data.
  foreach t in array array[
    'divisions','clubs','players','player_division_history','pairs','pair_members',
    'tournament_registrations','match_players','player_rating_history','tournament_points',
    'monthly_rankings','player_stats','pair_stats','historical_monthly_stats','site_settings'
  ] loop
    execute format('drop policy if exists public_read on public.%I', t);
    execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Tournaments and matches: drafts stay private.
drop policy if exists public_read on public.tournaments;
create policy public_read on public.tournaments for select to anon, authenticated using (status <> 'draft');

drop policy if exists public_read on public.matches;
create policy public_read on public.matches for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.status <> 'draft'));

-- The active scoring ruleset is public so the rules page can explain it.
drop policy if exists public_read on public.scoring_settings;
create policy public_read on public.scoring_settings for select to anon, authenticated using (is_active);

-- player_private, users, rating_adjustments, import_logs, admin_audit_logs and
-- recalc_runs have no public policy: admins only.

-- Supabase Storage bucket for player photos (public read, admin write).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('player-photos', 'player-photos', true)
      on conflict (id) do nothing;
    execute 'drop policy if exists "player photos public read" on storage.objects';
    execute 'create policy "player photos public read" on storage.objects for select using (bucket_id = ''player-photos'')';
    execute 'drop policy if exists "player photos admin write" on storage.objects';
    execute 'create policy "player photos admin write" on storage.objects for all to authenticated using (bucket_id = ''player-photos'' and public.is_admin()) with check (bucket_id = ''player-photos'' and public.is_admin())';
  end if;
end $$;
