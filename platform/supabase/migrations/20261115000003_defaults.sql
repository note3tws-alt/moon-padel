-- MoonPadel: default divisions, scoring ruleset and site settings.
-- Safe to re-run. The scoring ruleset is a DEMO ruleset, not an official league rule.

insert into public.divisions (code, name, sort_order, color, description, promote_top_n, relegate_bottom_n)
values
  ('D1', 'Elite',        1, '#A9DBFF', 'Strongest division.', 0, 0),
  ('D2', 'Advanced',     2, '#2E8BEA', 'Advanced players.',   0, 0),
  ('D3', 'Intermediate', 3, '#1D3FA6', 'Intermediate players.', 0, 0),
  ('D4', 'Beginner',     4, '#8FA0BC', 'Newer players.',      0, 0)
on conflict (code) do nothing;

insert into public.scoring_settings (name, is_active, notes, config)
select 'Demo ruleset (not official)', true,
  'Placeholder values so the platform works end to end. Replace with the official MoonPadel ruleset in Admin > Scoring settings.',
  '{
    "version": 1,
    "rating": {
      "method": "elo",
      "initial": 3.0,
      "min": 0,
      "max": 7,
      "decimals": 2,
      "elo": { "k": 0.12, "spread": 1.5, "marginOfVictory": true },
      "provisional": { "matches": 10, "kMultiplier": 1.5 },
      "weighted": { "halfLifeDays": 60, "windowMatches": 40 },
      "visibleAfterMatches": 5,
      "visibleAfterTournaments": 1
    },
    "points": {
      "win": 3,
      "draw": 1,
      "loss": 0,
      "perGameWon": 0,
      "courtMultipliers": { "default": 1 },
      "placement": [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      "participation": 0
    },
    "standings": {
      "bestTournamentsMonthly": 3,
      "bestTournamentsAllTime": 10,
      "tieBreakers": ["points", "wins", "winPct", "gameDiff", "rating", "fewerTournaments"],
      "individualIncludesFixedPairs": false
    },
    "tournament": {
      "finishOrder": ["winPoints", "gameDiff", "gamesWon", "rating"]
    }
  }'::jsonb
where not exists (select 1 from public.scoring_settings);

insert into public.site_settings (key, value) values
  ('general', '{
    "leagueName": "MoonPadel",
    "tagline": "Play beyond.",
    "heroTitle": "PLAY. COMPETE. RISE.",
    "heroSubtitle": "Your game. Your ranking. Your journey.",
    "city": "Dubai",
    "whatsappNumber": "",
    "instagramHandle": "",
    "contactEmail": "",
    "showDemoBanner": true
  }'::jsonb),
  ('rules', '{
    "intro": "MoonPadel ranks every player from verified match results. The numbers below come straight from the active scoring ruleset, so this page always matches how the league is actually calculated.",
    "sections": [
      { "title": "Divisions", "body": "Players compete in four divisions, from D1 (Elite) to D4 (Beginner). The organisers place new players after their first event and review divisions every month." },
      { "title": "Fair play", "body": "Results are entered by the organisers and verified before they count. Play to your real level: deliberately playing below it is not allowed." },
      { "title": "Fixed and non-fixed pairs", "body": "In non-fixed events your partner changes between rounds and you are ranked individually. In fixed-pair events you play with the same partner all night and the pair is ranked together." }
    ]
  }'::jsonb)
on conflict (key) do nothing;
