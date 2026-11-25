import { ActionForm, SubmitButton } from "../action-form";
import { Field } from "../page-header";
import { saveEvent } from "@/app/admin/(panel)/events/actions";

type Club = { id: string; name: string };
type Tier = { id: number; code: string; numeric_order: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EventForm({ event, clubs, tiers, locked }: { event?: any; clubs: Club[]; tiers: Tier[]; locked?: boolean }) {
  const e = event ?? {};
  const eligible = new Set<number>(e.eligible_tier_ids ?? []);
  return (
    <ActionForm action={saveEvent} className="space-y-6">
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <section className="card p-5">
        <h2 className="mb-4 font-bold">Event</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Title *" className="lg:col-span-2"><input name="title" required defaultValue={e.title ?? "MoonPadel Ladder Americano"} className="input" /></Field>
          <Field label="Date *"><input name="event_date" type="date" required defaultValue={e.event_date ?? ""} className="input" /></Field>
          <Field label="Club / venue" hint="Add venues in Clubs / venues.">
            <select name="club_id" defaultValue={e.club_id ?? ""} className="select">
              <option value="">Not in the list</option>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Or venue name" hint="Used when no club is picked. Leave as [VENUE] until booked."><input name="venue_name" defaultValue={e.venue_name ?? ""} className="input" placeholder="[VENUE]" /></Field>
          <Field label="Start time (Dubai)"><input name="start_time" type="time" defaultValue={e.start_time?.slice(0, 5) ?? ""} className="input" /></Field>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-1 font-bold">Format: Ladder Americano</h2>
        <p className="mb-4 text-xs text-muted">4 players per court, partners rotate every round, winners move up a court and losers move down. Capacity is always 4 x courts.</p>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Courts"><input name="court_count" type="number" min={1} max={12} defaultValue={e.court_count ?? 4} disabled={locked} className="input" /></Field>
          <Field label="Rounds"><input name="round_count" type="number" min={1} max={20} defaultValue={e.round_count ?? 6} className="input" /></Field>
          <Field label="Minutes per round"><input name="round_minutes" type="number" min={1} max={120} defaultValue={e.round_minutes ?? 15} className="input" /></Field>
          <Field label="Change-over minutes" hint="Score entry + walking between rounds."><input name="transition_minutes" type="number" min={0} max={30} defaultValue={e.transition_minutes ?? 0} className="input" /></Field>
          <Field label="Booking length (min)"><input name="duration_minutes" type="number" min={15} defaultValue={e.duration_minutes ?? 90} className="input" /></Field>
          <Field label="TV screen change (s)"><input name="tv_cycle_seconds" type="number" min={5} max={120} defaultValue={e.tv_cycle_seconds ?? 12} className="input" /></Field>
        </div>
        {locked && <input type="hidden" name="court_count" value={e.court_count} />}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="When a match ends level" hint="Proposed rule, pending founder sign-off.">
            <select name="tie_rule" defaultValue={e.tie_rule ?? "admin"} className="select">
              <option value="admin">Organiser picks the pair that moves up</option>
              <option value="golden_point">Golden point, entered on the tablet</option>
            </select>
          </Field>
          <div>
            <span className="field-label">Levels in this event</span>
            <div className="flex flex-wrap gap-2">
              {tiers.map((t) => (
                <label key={t.id} className="chip cursor-pointer text-silver has-[:checked]:border-electric has-[:checked]:bg-electric/15">
                  <input type="checkbox" name="eligible_tier_ids" value={t.id} defaultChecked={eligible.has(t.id)} className="accent-electric" />{t.code}
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-muted">Shown on the website. Mixed levels are allowed; strongest levels start on court 1.</span>
          </div>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-bold">Options</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["is_public", "Publish: show on the website and public live page", e.is_public ?? false],
            ["count_in_league", "Add final results to league rankings and profiles", e.count_in_league ?? true],
            ["require_pin", "Ask for the player's 4-digit code on the tablet", e.require_pin ?? false],
          ].map(([name, label, on]) => (
            <label key={name as string} className="flex items-center gap-3 text-sm"><input type="checkbox" name={name as string} defaultChecked={on as boolean} className="h-4 w-4 accent-electric" />{label as string}</label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Public note" hint="Short line on the website card. No fees or prizes until confirmed."><input name="public_note" defaultValue={e.public_note ?? ""} className="input" /></Field>
          <Field label="Private notes" hint="Admin only. Never on the TV or website."><input name="notes" defaultValue={e.notes ?? ""} className="input" /></Field>
        </div>
      </section>
      <div className="flex justify-end"><SubmitButton>{e.id ? "Save event" : "Create event"}</SubmitButton></div>
    </ActionForm>
  );
}
