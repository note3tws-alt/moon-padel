/**
 * Fictional demo data. Every row is flagged is_demo = true so it can be
 * removed in one step (Admin > Website settings, or `npm run db:remove-demo`).
 * Names, venues and results are invented and have no link to any real player,
 * venue or league. Entry fees are left empty on purpose.
 */
import { sql, type Tx } from "./db";
import { recalculateAll } from "./recalc";
import { slugify, todayDubai } from "./utils";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Omar", "Lucia", "Karim", "Sofia", "Rami", "Elena", "Yusuf", "Mia", "Tariq", "Noor", "Mateo", "Hana", "Ibrahim", "Clara", "Faris", "Leila", "Diego", "Amira", "Hugo", "Zara", "Samir", "Ines", "Adam", "Maya", "Nikolai", "Salma", "Luca", "Dina", "Rafael", "Yara", "Jonas", "Aisha", "Pablo", "Reem", "Theo", "Laila", "Marco", "Sara", "Ali", "Nadia", "Felix", "Lina"];
const LAST = ["Haddad", "Moreno", "Farouk", "Rossi", "Nasser", "Petrov", "Kaya", "Larsen", "Mansour", "Silva", "Aziz", "Duarte", "Khalil", "Weber", "Saleh", "Romero", "Hamdan", "Novak", "Bakr", "Costa", "Rahman", "Jansen", "Qasim", "Ferreira", "Sabri", "Lindqvist", "Darwish", "Navarro", "Amin", "Keller", "Yousef", "Marin", "Obeid", "Bianchi", "Hijazi", "Svensson", "Toma", "Rivas", "Zayed", "Murray", "Fakhoury", "Ortega"];
const COUNTRIES = ["AE", "ES", "EG", "IT", "LB", "RU", "TR", "SE", "JO", "BR", "SA", "PT", "SY", "DE", "AE", "AR", "AE", "CZ", "MA", "PT", "IN", "NL", "IQ", "PT", "TN", "SE", "PS", "ES", "EG", "CH", "AE", "ES", "OM", "IT", "LB", "SE", "RO", "MX", "AE", "GB", "LB", "ES"];
const CLUBS = [
  { name: "Crater Courts (demo)", area: "Demo district A", courts: 6 },
  { name: "Tidewater Padel (demo)", area: "Demo district B", courts: 4 },
  { name: "Orbit Sports Hall (demo)", area: "Demo district C", courts: 8 },
  { name: "Eclipse Padel Park (demo)", area: "Demo district D", courts: 5 },
];
const PAIR_NAMES = ["Night Owls", "Low Tide", "Second Serve", "Glass Wall", "Bandeja Club", "Late Lobs", "Back Fence", "Golden Hour"];

export async function hasDemoData(): Promise<boolean> {
  const [r] = await sql()`select exists(select 1 from players where is_demo) or exists(select 1 from tournaments where is_demo) as has`;
  return Boolean(r?.has);
}

export async function removeDemoData(tx?: Tx) {
  const run = async (t: Tx) => {
    const tours = await t`delete from tournaments where is_demo returning id`;
    const pairs = await t`delete from pairs where is_demo returning id`;
    // Matches in non-demo tournaments that used demo players block deletion (match_players is ON DELETE RESTRICT).
    const players = await t`delete from players where is_demo returning id`;
    const clubs = await t`delete from clubs where is_demo returning id`;
    await recalculateAll("remove-demo", t);
    return { tournaments: tours.length, pairs: pairs.length, players: players.length, clubs: clubs.length };
  };
  return tx ? run(tx) : sql().begin(run);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedDemoData() {
  const rnd = prng(20261115);
  return sql().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(424243)`;
    const [{ n }] = await tx`select count(*)::int as n from players where is_demo`;
    if (n > 0) throw new Error("Demo data is already loaded. Remove it first to reload.");

    const divisions = await tx`select id, code from divisions order by sort_order`;
    if (divisions.length < 4) throw new Error("Expected four divisions. Run the migrations first.");

    // Clubs
    const clubIds: string[] = [];
    for (const c of CLUBS) {
      const [row] = await tx`insert into clubs (slug, name, area, city, courts, is_demo) values (${slugify(c.name)}, ${c.name}, ${c.area}, 'Dubai', ${c.courts}, true)
                             on conflict (slug) do update set name = excluded.name returning id`;
      clubIds.push(row.id);
    }

    // Players: 40, ten per division, with a hidden "true skill" used to simulate results.
    // Starting ratings are set by division, as organisers would when placing players.
    type P = { id: string; name: string; div: number; skill: number };
    const players: P[] = [];
    for (let i = 0; i < 40; i++) {
      const divIndex = Math.floor(i / 10);
      const div = divisions[divIndex];
      const name = `${FIRST[i]} ${LAST[i]}`;
      const skill = 5.6 - divIndex * 1.0 - rnd() * 0.9;
      const code = `MP-D${String(i + 1).padStart(3, "0")}`;
      const [row] = await tx`
        insert into players (player_code, slug, full_name, country_code, nationality, playing_side, division_id, base_rating, is_demo)
        values (${code}, ${slugify(name)}, ${name}, ${COUNTRIES[i]}, null, ${["left", "right", "both"][i % 3]}, ${div.id}, ${4.5 - divIndex * 0.75}, true)
        returning id`;
      await tx`insert into player_private (player_id, email) values (${row.id}, ${`demo.player${i + 1}@example.com`})`;
      await tx`insert into player_division_history (player_id, to_division_id, kind, reason) values (${row.id}, ${div.id}, 'initial', 'Demo data')`;
      players.push({ id: row.id, name, div: divIndex, skill });
    }

    // Fixed pairs: two per division.
    type Pair = { id: string; div: number; members: P[] };
    const pairs: Pair[] = [];
    for (let d = 0; d < 4; d++) {
      const pool = players.filter((p) => p.div === d);
      for (let k = 0; k < 2; k++) {
        const members = [pool[k * 2], pool[k * 2 + 1]];
        const name = PAIR_NAMES[d * 2 + k];
        const [row] = await tx`insert into pairs (slug, name, division_id, is_demo) values (${slugify(name)}, ${name}, ${divisions[d].id}, true) returning id`;
        await tx`insert into pair_members (pair_id, player_id, position) values (${row.id}, ${members[0].id}, 1), (${row.id}, ${members[1].id}, 2)`;
        pairs.push({ id: row.id, div: d, members });
      }
    }
    // A further two pairs per division made of the next players, so fixed events have four pairs.
    for (let d = 0; d < 4; d++) {
      const pool = players.filter((p) => p.div === d);
      for (let k = 2; k < 4; k++) {
        const members = [pool[k * 2], pool[k * 2 + 1]];
        const name = `${members[0].name.split(" ")[1]} / ${members[1].name.split(" ")[1]}`;
        const [row] = await tx`insert into pairs (slug, name, division_id, is_demo) values (${slugify(name)}, ${name}, ${divisions[d].id}, true) returning id`;
        await tx`insert into pair_members (pair_id, player_id, position) values (${row.id}, ${members[0].id}, 1), (${row.id}, ${members[1].id}, 2)`;
        pairs.push({ id: row.id, div: d, members });
      }
    }

    const win = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 1.2));
    const score = (pA: number): [number, number] => {
      const aWins = rnd() < pA;
      const loserGames = Math.floor(rnd() * 5); // 0..4
      return aWins ? [6, loserGames] : [loserGames, 6];
    };

    const today = todayDubai();
    const start = addDays(today, -125);
    let tCount = 0;
    const tournamentNames = ["Moonrise Ladder", "Night Session", "Full Moon Ladder", "Midweek Ladder", "Weekend Ladder"];

    // Past tournaments: every 3 to 4 days, rotating divisions; every fourth is a fixed-pairs event.
    for (let day = 0, idx = 0; addDays(start, day) < addDays(today, -1); day += 3 + (idx % 2), idx++) {
      const date = addDays(start, day);
      const d = idx % 4;
      const fixed = idx % 5 === 4;
      const division = divisions[d];
      const club = clubIds[idx % clubIds.length];
      tCount++;
      const baseName = fixed ? "Fixed Pairs Night" : tournamentNames[idx % tournamentNames.length];
      const name = `${baseName} ${division.code} #${tCount}`;
      const startTime = idx % 3 === 0 ? "19:30" : idx % 3 === 1 ? "20:30" : "18:00";
      const [t] = await tx`
        insert into tournaments (slug, name, tournament_date, start_time, duration_minutes, club_id, division_id, format, pair_type,
                                 courts_count, rounds_count, max_players, entry_fee, status, results_published, description, is_demo)
        values (${slugify(name)}, ${name}, ${date}, ${startTime}, ${fixed ? 120 : 90}, ${club}, ${division.id},
                ${fixed ? "round_robin" : "ladder"}, ${fixed ? "fixed" : "non_fixed"}, ${fixed ? 2 : 2}, ${fixed ? 3 : 5},
                ${fixed ? 8 : 8}, null, 'completed', true, ${"Fictional demo tournament generated to show how the platform works."}, true)
        returning id`;

      if (!fixed) {
        // 8 players from the division, ladder over 5 rounds on 2 courts.
        const pool = players.filter((p) => p.div === d).sort(() => rnd() - 0.5).slice(0, 8);
        for (const p of pool) await tx`insert into tournament_registrations (tournament_id, player_id) values (${t.id}, ${p.id})`;
        let order = [...pool].sort((a, b) => b.skill - a.skill);
        for (let r = 1; r <= 5; r++) {
          const next: P[][] = [];
          for (let c = 0; c < 2; c++) {
            const four = order.slice(c * 4, c * 4 + 4);
            const pattern = [[0, 3, 1, 2], [0, 2, 1, 3], [0, 1, 2, 3]][(r - 1) % 3];
            const A = [four[pattern[0]], four[pattern[1]]];
            const B = [four[pattern[2]], four[pattern[3]]];
            const pA = win((A[0].skill + A[1].skill) / 2, (B[0].skill + B[1].skill) / 2);
            const [ga, gb] = score(pA);
            const winner = ga > gb ? "A" : "B";
            const [m] = await tx`
              insert into matches (tournament_id, round_number, court_number, match_date, duration_minutes, set_scores, team_a_games, team_b_games, winner, status, verified)
              values (${t.id}, ${r}, ${c + 1}, ${`${date}T${startTime}:00+04:00`}::timestamptz + make_interval(mins => ${(r - 1) * 18}), 16,
                      ${tx.json([[ga, gb]])}, ${ga}, ${gb}, ${winner}, 'completed', true)
              returning id`;
            for (const p of A) await tx`insert into match_players (match_id, player_id, team) values (${m.id}, ${p.id}, 'A')`;
            for (const p of B) await tx`insert into match_players (match_id, player_id, team) values (${m.id}, ${p.id}, 'B')`;
            next.push(winner === "A" ? [...A, ...B] : [...B, ...A]);
          }
          // Ladder movement: winners of court 2 move up, losers of court 1 move down.
          const [c1, c2] = next;
          order = [c1[0], c1[1], c2[0], c2[1], c1[2], c1[3], c2[2], c2[3]];
        }
      } else {
        // 4 pairs, round robin over 3 rounds on 2 courts.
        const dp = pairs.filter((p) => p.div === d);
        for (const pr of dp) for (const mbr of pr.members) await tx`insert into tournament_registrations (tournament_id, player_id, pair_id) values (${t.id}, ${mbr.id}, ${pr.id})`;
        const schedule = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
        for (let r = 1; r <= 3; r++) {
          for (let c = 0; c < 2; c++) {
            const [ia, ib] = schedule[r - 1][c];
            const A = dp[ia], B = dp[ib];
            const sa = (A.members[0].skill + A.members[1].skill) / 2 + 0.15; // chemistry bonus for fixed pairs
            const sb = (B.members[0].skill + B.members[1].skill) / 2 + 0.15;
            const pA = win(sa, sb);
            const s1 = score(pA), s2 = score(pA);
            let sets = [s1, s2];
            const setsA = sets.filter(([a, b]) => a > b).length;
            if (setsA === 1) sets = [...sets, score(pA)];
            const gA = sets.reduce((s, x) => s + x[0], 0), gB = sets.reduce((s, x) => s + x[1], 0);
            const wonA = sets.filter(([a, b]) => a > b).length;
            const winner = wonA >= 2 ? "A" : "B";
            const [m] = await tx`
              insert into matches (tournament_id, round_number, court_number, match_date, duration_minutes, team_a_pair_id, team_b_pair_id, set_scores, team_a_games, team_b_games, winner, status, verified)
              values (${t.id}, ${r}, ${c + 1}, ${`${date}T${startTime}:00+04:00`}::timestamptz + make_interval(mins => ${(r - 1) * 40}), 38,
                      ${A.id}, ${B.id}, ${tx.json(sets)}, ${gA}, ${gB}, ${winner}, 'completed', true)
              returning id`;
            for (const p of A.members) await tx`insert into match_players (match_id, player_id, team) values (${m.id}, ${p.id}, 'A')`;
            for (const p of B.members) await tx`insert into match_players (match_id, player_id, team) values (${m.id}, ${p.id}, 'B')`;
          }
        }
      }
    }

    // Upcoming tournaments over the next three weeks with partial registrations.
    const upcoming = [
      { offset: 2, d: 0, status: "registration_open", reg: 5, cap: 8, fixed: false },
      { offset: 4, d: 2, status: "full", reg: 8, cap: 8, fixed: false },
      { offset: 6, d: 1, status: "registration_open", reg: 3, cap: 12, fixed: false },
      { offset: 9, d: 3, status: "registration_open", reg: 4, cap: 8, fixed: true },
      { offset: 13, d: 0, status: "upcoming", reg: 0, cap: 16, fixed: false },
      { offset: 20, d: 2, status: "upcoming", reg: 0, cap: 12, fixed: false },
    ];
    for (const [i, u] of upcoming.entries()) {
      const division = divisions[u.d];
      tCount++;
      const name = `${u.fixed ? "Fixed Pairs Night" : tournamentNames[i % tournamentNames.length]} ${division.code} #${tCount}`;
      const [t] = await tx`
        insert into tournaments (slug, name, tournament_date, start_time, duration_minutes, club_id, division_id, format, pair_type, courts_count, rounds_count, max_players, entry_fee, status, description, is_demo)
        values (${slugify(name)}, ${name}, ${addDays(today, u.offset)}, ${i % 2 ? "20:30" : "19:30"}, ${u.fixed ? 120 : 90}, ${clubIds[i % clubIds.length]}, ${division.id},
                ${u.fixed ? "round_robin" : "ladder"}, ${u.fixed ? "fixed" : "non_fixed"}, ${Math.ceil(u.cap / 4)}, ${u.fixed ? 3 : 5}, ${u.cap}, null, ${u.status},
                ${"Fictional demo tournament generated to show how the platform works."}, true)
        returning id`;
      const pool = players.filter((p) => p.div === u.d).slice(0, u.reg);
      for (const p of pool) await tx`insert into tournament_registrations (tournament_id, player_id) values (${t.id}, ${p.id})`;
    }

    const result = await recalculateAll("seed-demo", tx);
    return { ...result, players: players.length, pairs: pairs.length, tournaments: tCount, clubs: clubIds.length };
  });
}
