-- MoonPadel league platform: core schema.
-- Runs on Supabase (Postgres 15+) or plain Postgres 14+.
-- Derived tables (player_stats, pair_stats, tournament_points, monthly_rankings,
-- player_rating_history) are rebuilt by the scoring engine and never edited by hand.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Admin users. id matches auth.users.id when Supabase Auth is used.
-- password_hash is only used by the local development login.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  display_name text,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  password_hash text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Divisions and their promotion / relegation rules.
-- ---------------------------------------------------------------------------
create table if not exists public.divisions (
  id smallserial primary key,
  code text not null unique,                 -- D1, D2, ...
  name text not null,                        -- Elite, Advanced, ...
  sort_order smallint not null default 0,    -- 1 = strongest
  min_rating numeric(8,3),
  max_rating numeric(8,3),
  color text,
  description text,
  promote_top_n smallint not null default 0,      -- monthly top N suggested for promotion
  relegate_bottom_n smallint not null default 0,  -- monthly bottom N suggested for relegation
  promotion_min_tournaments smallint not null default 0,
  use_rating_thresholds boolean not null default false, -- also suggest moves when rating leaves the band
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clubs / venues where tournaments are hosted. Moon Padel is an organiser,
-- so these are partner venues, not owned clubs.
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  area text,
  city text,
  address text,
  map_url text,
  courts smallint,
  website text,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Players. Public profile fields only; contact details live in player_private.
-- base_* columns hold statistics imported from before the platform existed.
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  player_code text not null unique,          -- public player ID, e.g. MP-0001
  slug text not null unique,
  full_name text not null,
  country_code char(2),                      -- ISO 3166-1 alpha-2, for the flag
  nationality text,
  photo_url text,
  playing_side text check (playing_side in ('left', 'right', 'both')),
  division_id smallint references public.divisions(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  base_rating numeric(8,3),
  base_points numeric(10,2) not null default 0,
  base_tournaments integer not null default 0,
  base_matches integer not null default 0,
  base_wins integer not null default 0,
  base_losses integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_division_idx on public.players(division_id);
create index if not exists players_name_idx on public.players(lower(full_name));

create table if not exists public.player_private (
  player_id uuid primary key references public.players(id) on delete cascade,
  email citext,
  phone text,
  notes text,
  updated_at timestamptz not null default now()
);
create unique index if not exists player_private_email_uq on public.player_private(email) where email is not null;

create table if not exists public.player_division_history (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  from_division_id smallint references public.divisions(id) on delete set null,
  to_division_id smallint references public.divisions(id) on delete set null,
  kind text not null default 'manual' check (kind in ('manual', 'promotion', 'relegation', 'import', 'initial')),
  reason text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pdh_player_idx on public.player_division_history(player_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Fixed pairs.
-- ---------------------------------------------------------------------------
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  division_id smallint references public.divisions(id) on delete set null,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pair_members (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  position smallint not null check (position in (1, 2)),
  primary key (pair_id, player_id),
  unique (pair_id, position)
);
create index if not exists pair_members_player_idx on public.pair_members(player_id);

-- ---------------------------------------------------------------------------
-- Tournaments.
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tournament_date date not null,
  start_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  club_id uuid references public.clubs(id) on delete set null,
  division_id smallint references public.divisions(id) on delete set null,  -- null = open / mixed
  format text not null default 'ladder' check (format in ('ladder', 'americano', 'mexicano', 'round_robin', 'groups_knockout', 'knockout')),
  pair_type text not null default 'non_fixed' check (pair_type in ('fixed', 'non_fixed')),
  courts_count smallint check (courts_count is null or courts_count > 0),
  rounds_count smallint check (rounds_count is null or rounds_count > 0),
  max_players integer check (max_players is null or max_players > 0),
  entry_fee numeric(10,2) check (entry_fee is null or entry_fee >= 0),
  currency char(3) not null default 'AED',
  status text not null default 'draft' check (status in ('draft', 'upcoming', 'registration_open', 'full', 'in_progress', 'completed', 'cancelled')),
  results_published boolean not null default false,
  description text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tournaments_date_idx on public.tournaments(tournament_date desc);
create index if not exists tournaments_status_idx on public.tournaments(status);

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  pair_id uuid references public.pairs(id) on delete set null,
  status text not null default 'registered' check (status in ('registered', 'waitlist', 'withdrawn')),
  final_position_override smallint,          -- admin override of the computed finish
  created_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);
create index if not exists treg_player_idx on public.tournament_registrations(player_id);

-- ---------------------------------------------------------------------------
-- Matches. set_scores is a JSON array of [teamA, teamB] games per set.
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number smallint not null check (round_number > 0),
  court_number smallint not null check (court_number > 0),
  match_date timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  team_a_pair_id uuid references public.pairs(id) on delete set null,
  team_b_pair_id uuid references public.pairs(id) on delete set null,
  set_scores jsonb not null default '[]'::jsonb,
  team_a_games smallint not null default 0,
  team_b_games smallint not null default 0,
  winner char(1) check (winner in ('A', 'B', 'D')),  -- D = draw
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'void')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round_number, court_number)
);
create index if not exists matches_tournament_idx on public.matches(tournament_id, round_number);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  team char(1) not null check (team in ('A', 'B')),
  primary key (match_id, player_id)
);
create index if not exists match_players_player_idx on public.match_players(player_id);

-- ---------------------------------------------------------------------------
-- Manual rating adjustments (applied by the engine in date order).
-- ---------------------------------------------------------------------------
create table if not exists public.rating_adjustments (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  effective_at timestamptz not null default now(),
  kind text not null default 'delta' check (kind in ('delta', 'set')),
  value numeric(8,3) not null,
  reason text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Historical monthly statistics imported from spreadsheets (pre-platform seasons).
create table if not exists public.historical_monthly_stats (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  division_id smallint references public.divisions(id) on delete set null,
  points numeric(10,2) not null default 0,
  tournaments integer not null default 0,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  rating numeric(8,3),
  import_id uuid,
  unique (player_id, month)
);

-- ---------------------------------------------------------------------------
-- Derived tables (rebuilt by the scoring engine).
-- ---------------------------------------------------------------------------
create table if not exists public.player_rating_history (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  adjustment_id bigint references public.rating_adjustments(id) on delete cascade,
  rated_at timestamptz not null,
  rating_before numeric(8,3),
  rating_after numeric(8,3) not null,
  delta numeric(8,3) not null default 0
);
create index if not exists prh_player_idx on public.player_rating_history(player_id, rated_at);

create table if not exists public.tournament_points (
  id bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entity_type text not null check (entity_type in ('player', 'pair')),
  player_id uuid references public.players(id) on delete cascade,
  pair_id uuid references public.pairs(id) on delete cascade,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  games_won integer not null default 0,
  games_lost integer not null default 0,
  win_points numeric(10,2) not null default 0,
  game_points numeric(10,2) not null default 0,
  placement_points numeric(10,2) not null default 0,
  total_points numeric(10,2) not null default 0,
  final_position smallint,
  check ((entity_type = 'player' and player_id is not null) or (entity_type = 'pair' and pair_id is not null))
);
create index if not exists tp_tournament_idx on public.tournament_points(tournament_id);
create index if not exists tp_player_idx on public.tournament_points(player_id);
create index if not exists tp_pair_idx on public.tournament_points(pair_id);

-- scope: 'overall' or a division code; mode: individual (non-fixed) or pair (fixed);
-- period: first day of the month, or null for all-time.
create table if not exists public.monthly_rankings (
  id bigserial primary key,
  period date,                               -- null = all-time
  mode text not null check (mode in ('individual', 'pair')),
  division_id smallint references public.divisions(id) on delete cascade, -- null = overall
  player_id uuid references public.players(id) on delete cascade,
  pair_id uuid references public.pairs(id) on delete cascade,
  rank integer not null,
  points numeric(10,2) not null default 0,
  rating numeric(8,3),
  tournaments integer not null default 0,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  is_champion boolean not null default false,
  computed_at timestamptz not null default now()
);
create index if not exists mr_lookup_idx on public.monthly_rankings(mode, period, division_id, rank);
create index if not exists mr_player_idx on public.monthly_rankings(player_id);
create index if not exists mr_pair_idx on public.monthly_rankings(pair_id);

create table if not exists public.player_stats (
  player_id uuid primary key references public.players(id) on delete cascade,
  rating numeric(8,3),
  rating_visible boolean not null default false,
  overall_rank integer,
  division_rank integer,
  total_points numeric(10,2) not null default 0,
  tournaments integer not null default 0,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  titles integer not null default 0,
  podiums integer not null default 0,
  last_played date,
  rating_change_7d numeric(8,3) not null default 0,
  rating_change_30d numeric(8,3) not null default 0,
  computed_at timestamptz not null default now()
);

create table if not exists public.pair_stats (
  pair_id uuid primary key references public.pairs(id) on delete cascade,
  rating numeric(8,3),
  overall_rank integer,
  total_points numeric(10,2) not null default 0,
  tournaments integer not null default 0,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  titles integer not null default 0,
  computed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Configuration, logs and audit trail.
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_settings (
  id serial primary key,
  name text not null,
  config jsonb not null,
  is_active boolean not null default false,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists scoring_settings_one_active on public.scoring_settings(is_active) where is_active;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('players', 'tournaments', 'matches', 'history')),
  filename text,
  mode text not null,
  status text not null check (status in ('completed', 'failed')),
  total_rows integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  failed integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  actor_id uuid references public.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists audit_entity_idx on public.admin_audit_logs(entity, entity_id);

create table if not exists public.recalc_runs (
  id bigserial primary key,
  trigger text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  matches_processed integer,
  ok boolean,
  error text
);
