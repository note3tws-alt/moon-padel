import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { playerLoginMethods } from "@/lib/player-auth";
import { approveClaim, rejectClaim, unlinkAccount } from "./actions";

export const metadata = { title: "Player accounts" };

export default async function AccountsAdmin() {
  const db = sql();
  const [claims, accounts, freePlayers, recent] = await Promise.all([
    db`select c.*, p.full_name, p.slug, p.player_code from player_claims c left join players p on p.id = c.player_id where c.status = 'pending' order by c.created_at`,
    db`select a.*, p.full_name, p.slug, p.player_code, u.email as linked_by_email
       from player_accounts a join players p on p.id = a.player_id left join users u on u.id = a.linked_by order by a.created_at desc`,
    db`select p.id, p.full_name, p.player_code from players p where p.status = 'active' and not exists (select 1 from player_accounts a where a.player_id = p.id) order by p.full_name`,
    db`select c.status, c.email, c.requested_name, c.decided_at, p.full_name from player_claims c left join players p on p.id = c.player_id
       where c.status in ('approved', 'rejected') order by c.decided_at desc nulls last limit 10`,
  ]);
  const methods = playerLoginMethods();
  const on = [methods.google && "Google", methods.email && "email link"].filter(Boolean).join(" and ");

  return (
    <>
      <PageHeader
        title="Player accounts"
        description={<>Players sign in on the public site and ask to connect their player profile. Nothing is connected until you approve it here, unless the email they sign in with is the exact email saved on their player record. Player sign-in is {on ? <b className="text-silver">on ({on})</b> : <b className="text-[#f2a08c]">off</b>}.</>}
      />

      <section className="mb-8">
        <h2 className="mb-3 font-bold">Waiting for approval <span className="text-muted">({claims.length})</span></h2>
        {claims.length === 0 && <p className="card p-5 text-sm text-muted">No requests right now.</p>}
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{c.email ?? "No email"}</p>
                  <p className="mt-1 text-sm text-muted">
                    {c.player_id
                      ? <>Says they are <Link href={`/admin/players/${c.player_id}`} className="text-ice hover:text-white">{c.full_name}</Link> ({c.player_code})</>
                      : <>Not on the list yet. Name given: <span className="text-silver">{c.requested_name}</span>. Create the player first, then pick them below.</>}
                  </p>
                  {c.message && <p className="mt-2 max-w-2xl rounded-lg bg-white/5 px-3 py-2 text-sm">{c.message}</p>}
                </div>
                <span className="text-xs text-muted">{fmtDate(c.created_at)}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <ActionForm action={approveClaim} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="claim_id" value={c.id} />
                  <label className="block">
                    <span className="field-label">Connect to</span>
                    <select name="player_id" defaultValue={c.player_id ?? ""} className="select min-w-[16rem]" required>
                      <option value="">Pick a player</option>
                      {c.player_id && <option value={c.player_id}>{c.full_name} ({c.player_code})</option>}
                      {freePlayers.filter((p) => p.id !== c.player_id).map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.player_code})</option>)}
                    </select>
                  </label>
                  <SubmitButton className="btn-sm" pendingText="Connecting…">Approve</SubmitButton>
                </ActionForm>
                <ActionForm action={rejectClaim} confirm="Decline this request?" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="claim_id" value={c.id} />
                  <label className="block"><span className="field-label">Note to player (optional)</span><input name="note" maxLength={300} className="input" placeholder="Shown on their account page" /></label>
                  <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Decline</SubmitButton>
                </ActionForm>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-bold">Connected accounts <span className="text-muted">({accounts.length})</span></h2>
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Player</th><th>Sign-in email</th><th>How</th><th>Since</th><th>Last profile edit</th><th /></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.auth_user_id}>
                  <td><Link href={`/admin/players/${a.player_id}`} className="font-semibold hover:text-white">{a.full_name}</Link> <span className="text-xs text-muted">{a.player_code}</span></td>
                  <td className="text-muted">{a.email ?? "–"}</td>
                  <td className="text-muted">{a.linked_via === "email_match" ? "Matching email" : `Approved${a.linked_by_email ? ` by ${a.linked_by_email}` : ""}`}</td>
                  <td className="text-muted">{fmtDate(a.created_at)}</td>
                  <td className="text-muted">{a.last_seen_at ? fmtDate(a.last_seen_at) : "–"}</td>
                  <td className="text-right">
                    <ActionForm action={unlinkAccount} confirm={`Disconnect ${a.full_name} from ${a.email ?? "this account"}?`}>
                      <input type="hidden" name="auth_user_id" value={a.auth_user_id} />
                      <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Disconnect</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && <tr><td colSpan={6} className="text-center text-muted">No player has connected an account yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Tip: to invite a player, save their email on their player record. When they sign in with that email, their profile connects by itself.</p>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 font-bold">Recently handled</h2>
          <ul className="card divide-y divide-line text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 px-5 py-3">
                <span>{r.email} <span className="text-muted">for {r.full_name ?? r.requested_name}</span></span>
                <span className={r.status === "approved" ? "text-ice" : "text-[#f2a08c]"}>{r.status === "approved" ? "Approved" : "Declined"} {fmtDate(r.decided_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
