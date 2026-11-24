-- MoonPadel event operations: Ladder Americano nights.
--
-- One authoritative event database shared by the admin control centre, the
-- venue check-in tablet (kiosk), the TV display, the public live page and the
-- marketing website. Built from the Developer Workflow & Scope Brief (Nov 2026).
--
--   skill_tiers            approved level tags (D-, D, D+, C-, ...), admin ordered
--   ladder_events          one event night: venue, time, courts, rounds, rules, state
--   ladder_participants    the roster, level at event, check-in time
--   ladder_matches         one row per court per round: teams, score, status
--   ladder_match_players   who played where (one row per player per round)
--   ladder_score_log       every score submit, confirm, dispute and correction
--   ladder_results         final individual totals and daily podium per event
--   medal_tiers            lifetime milestone medals (50, 100, ... editable)
--   player_points_ledger   permanent lifetime points, one row per player per event
--   player_medals          unlocked / issued milestone medals
--
-- Kiosk and TV never use database credentials: the server checks a long
-- random token per event and returns only public fields (never phone numbers
-- or notes).

-- ---------------------------------------------------------------------------
-- Skill tiers. numeric_order 1 = strongest.
-- ---------------------------------------------------------------------------
create table if not exists public.skill_tiers (
  id smallserial primary key,
  code text not null unique,
  display_name text not null,
  numeric_order smallint not null,
  active boolean not null default true,
  event_eligible boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.skill_tiers (code, display_name, numeric_order) values
  ('C+', 'C+', 1), ('C', 'C', 2), ('C-', 'C-', 3),
  ('D+', 'D+', 4), ('D', 'D', 5), ('D-', 'D-', 6)
on conflict (code) do nothing;

alter table public.players add column if not exists skill_tier_id smallint references public.skill_tiers(id) on delete set null;
create index if not exists players_skill_tier_idx on public.players(skill_tier_id);

-- Optional 4-digit check-in code, private like phone numbers.
alter table public.player_private add column if not exists checkin_pin text check (checkin_pin is null or checkin_pin ~ '^[0-9]{4}$');

-- ---------------------------------------------------------------------------
-- Events.
-- ---------------------------------------------------------------------------
create table if not exists public.ladder_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  club_id uuid references public.clubs(id) on delete set null,
  venue_name text,                                 -- free text when the club is not in the list yet
  event_date date not null,
  start_time time,
  duration_minutes integer not null default 90 check (duration_minutes > 0),
  court_count smallint not null default 4 check (court_count between 1 and 12),
  player_cap smallint not null default 16 check (player_cap > 0),
  round_count smallint not null default 6 check (round_count between 1 and 20),
  round_minutes smallint not null default 15 check (round_minutes between 1 and 120),
  transition_minutes smallint not null default 0 check (transition_minutes between 0 and 30),
  scoring_mode text not null default 'games' check (scoring_mode in ('games')),
  tie_rule text not null default 'admin' check (tie_rule in ('admin', 'golden_point')),
  movement text not null default 'adjacent' check (movement in ('adjacent')),
  eligible_tier_ids smallint[] not null default '{}',
  format text not null default 'ladder_americano' check (format in ('ladder_americano')),
  require_pin boolean not null default false,
  state text not null default 'draft' check (state in (
    'draft', 'checkin_open', 'ready', 'round_live', 'score_collection', 'round_locked', 'completed', 'cancelled')),
  current_round smallint not null default 0,
  round_started_at timestamptz,
  round_ends_at timestamptz,
  paused_remaining_seconds integer,               -- set while the round clock is paused
  manual_order jsonb not null default '{}'::jsonb, -- organiser tie decision: { player_id: order }
  kiosk_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  tv_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  tv_mode text not null default 'auto' check (tv_mode in ('auto', 'checkin', 'courts', 'leaderboard', 'results', 'podium')),
  tv_cycle_seconds smallint not null default 12 check (tv_cycle_seconds between 5 and 120),
  is_public boolean not null default false,        -- published: show on the website and the public live page
  count_in_league boolean not null default true,   -- publish the final results to league rankings
  tournament_id uuid references public.tournaments(id) on delete set null,
  notes text,                                      -- private, admin only
  public_note text,                                -- shown on the website card
  version bigint not null default 1,               -- bumped on every change; screens refetch when it moves
  finalized_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ladder_events_date_idx on public.ladder_events(event_date desc);
create index if not exists ladder_events_state_idx on public.ladder_events(state);

create table if not exists public.ladder_participants (
  event_id uuid not null references public.ladder_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  tier_id_at_event smallint references public.skill_tiers(id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed', 'reserve', 'removed')),
  checked_in_at timestamptz,
  checked_in_via text,                             -- 'kiosk' or 'admin:<email>'
  added_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
create index if not exists ladder_participants_player_idx on public.ladder_participants(player_id);

create table if not exists public.ladder_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ladder_events(id) on delete cascade,
  round_no smallint not null check (round_no > 0),
  court_no smallint not null check (court_no > 0),
  team1 uuid[] not null check (array_length(team1, 1) = 2),
  team2 uuid[] not null check (array_length(team2, 1) = 2),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'awaiting', 'pending', 'disputed', 'confirmed', 'locked')),
  team1_games smallint check (team1_games is null or team1_games between 0 and 99),
  team2_games smallint check (team2_games is null or team2_games between 0 and 99),
  advancing smallint check (advancing in (1, 2)),  -- tie decided by admin or golden point
  submitted_by_team smallint check (submitted_by_team in (1, 2)),
  submitted_by_player uuid references public.players(id) on delete set null,
  submitted_at timestamptz,
  confirmed_by text,                               -- 'player:<id>' or 'admin:<email>'
  confirmed_at timestamptz,
  locked_at timestamptz,
  revision integer not null default 0,             -- optimistic lock: every write must match it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, round_no, court_no)
);
create index if not exists ladder_matches_event_idx on public.ladder_matches(event_id, round_no);

-- One row per player per round: the database itself refuses to put a player
-- on two courts in the same round.
create table if not exists public.ladder_match_players (
  match_id uuid not null references public.ladder_matches(id) on delete cascade,
  event_id uuid not null references public.ladder_events(id) on delete cascade,
  round_no smallint not null,
  player_id uuid not null references public.players(id) on delete restrict,
  team smallint not null check (team in (1, 2)),
  primary key (match_id, player_id),
  unique (event_id, round_no, player_id)
);
create index if not exists ladder_match_players_player_idx on public.ladder_match_players(player_id);

create table if not exists public.ladder_score_log (
  id bigserial primary key,
  event_id uuid not null references public.ladder_events(id) on delete cascade,
  match_id uuid references public.ladder_matches(id) on delete cascade,
  action text not null,                            -- submit, confirm, dispute, override, tie_decision, reopen, ...
  old_value jsonb,
  new_value jsonb,
  actor text not null,                             -- 'kiosk:player:<id>', 'admin:<email>', 'system'
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists ladder_score_log_event_idx on public.ladder_score_log(event_id, created_at desc);

create table if not exists public.ladder_results (
  event_id uuid not null references public.ladder_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  rank smallint not null,
  total integer not null,
  wins smallint not null,
  games_for integer not null,
  games_against integer not null,
  round_scores smallint[] not null,
  medal text check (medal in ('gold', 'silver', 'bronze')),
  primary key (event_id, player_id)
);
create index if not exists ladder_results_player_idx on public.ladder_results(player_id);

-- ---------------------------------------------------------------------------
-- Lifetime points and milestone medals.
-- ---------------------------------------------------------------------------
create table if not exists public.medal_tiers (
  id serial primary key,
  name text not null unique,
  threshold integer not null unique check (threshold > 0),
  image_url text,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Starter thresholds from the brief (50, 100, 150, 250). Names are working
-- labels until the founders approve them; edit both in Admin > Medals.
insert into public.medal_tiers (name, threshold, sort_order) values
  ('Milestone 50', 50, 1), ('Milestone 100', 100, 2), ('Milestone 150', 150, 3), ('Milestone 250', 250, 4)
on conflict do nothing;

create table if not exists public.player_points_ledger (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  event_id uuid references public.ladder_events(id) on delete set null,
  kind text not null default 'event' check (kind in ('event', 'adjustment')),
  points integer not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists ppl_one_per_event on public.player_points_ledger(player_id, event_id) where kind = 'event';
create index if not exists ppl_player_idx on public.player_points_ledger(player_id);

create table if not exists public.player_medals (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  medal_tier_id integer not null references public.medal_tiers(id) on delete restrict,
  event_id uuid references public.ladder_events(id) on delete set null,
  points_at_unlock integer not null,
  unlocked_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by text,
  unique (player_id, medal_tier_id)                -- a milestone can never be awarded twice
);

create table if not exists public.medal_log (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  medal_tier_id integer references public.medal_tiers(id) on delete set null,
  action text not null,                            -- unlocked, issued, unissued, revoked
  actor text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Every change bumps the event version, so screens refetch only on change.
-- ---------------------------------------------------------------------------
create or replace function public.ladder_bump_version() returns trigger
language plpgsql as $$
declare eid uuid;
begin
  if tg_table_name = 'ladder_events' then
    new.version := old.version + 1;
    new.updated_at := now();
    return new;
  end if;
  eid := coalesce(new.event_id, old.event_id);
  update public.ladder_events set version = version + 1, updated_at = now() where id = eid;
  return coalesce(new, old);
end $$;

drop trigger if exists ladder_events_version on public.ladder_events;
create trigger ladder_events_version before update on public.ladder_events
  for each row when (old.version = new.version) execute function public.ladder_bump_version();
drop trigger if exists ladder_participants_version on public.ladder_participants;
create trigger ladder_participants_version after insert or update or delete on public.ladder_participants
  for each row execute function public.ladder_bump_version();
drop trigger if exists ladder_matches_version on public.ladder_matches;
create trigger ladder_matches_version after insert or update or delete on public.ladder_matches
  for each row execute function public.ladder_bump_version();

-- ---------------------------------------------------------------------------
-- Row level security: same model as the league tables. The server uses the
-- direct connection; the public API can read only published, safe data.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'skill_tiers','ladder_events','ladder_participants','ladder_matches','ladder_match_players',
    'ladder_score_log','ladder_results','medal_tiers','player_points_ledger','player_medals','medal_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['skill_tiers','medal_tiers','player_points_ledger','player_medals','ladder_results'] loop
    execute format('drop policy if exists public_read on public.%I', t);
    execute format('create policy public_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
-- ladder_events holds the kiosk/TV tokens and private notes, so it has no
-- public policy: the website reads events through the app's /api/public/events.
