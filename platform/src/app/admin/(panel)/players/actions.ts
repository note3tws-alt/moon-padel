"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminMutation, formObject, type ActionState } from "@/lib/admin/action";
import { nextPlayerCode, uniquePlayerSlug } from "@/lib/admin/players";
import { audit } from "@/lib/audit";
import { toCountryCode } from "@/lib/countries";
import { uploadPlayerPhoto } from "@/lib/photos";

const optNum = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().finite().nullable());
const optInt = z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0));
const optStr = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v), z.string().nullable());

const playerSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(120),
  player_code: optStr.refine((v) => v == null || /^[A-Za-z0-9-_]{2,30}$/.test(v), "Letters, numbers and dashes only"),
  country: optStr,
  nationality: optStr,
  photo_url: optStr.refine((v) => v == null || /^https?:\/\//.test(v), "Must start with http:// or https://"),
  playing_side: z.enum(["", "left", "right", "both"]).transform((v) => v || null),
  division_id: optNum,
  division_reason: optStr,
  status: z.enum(["active", "inactive"]).default("active"),
  email: optStr.refine((v) => v == null || z.string().email().safeParse(v).success, "Invalid email"),
  phone: optStr,
  notes: optStr,
  base_rating: optNum,
  base_points: optNum.transform((v) => v ?? 0),
  base_tournaments: optInt,
  base_matches: optInt,
  base_wins: optInt,
  base_losses: optInt,
});

export async function savePlayer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = (fd.get("id") as string) || null;
  let createdId: string | null = null;
  const res = await adminMutation(async ({ admin, tx }) => {
    const v = playerSchema.parse(formObject(fd));
    const country = v.country ? toCountryCode(v.country) : null;
    if (v.country && !country) throw new Error(`Unknown country "${v.country}". Use a 2-letter code like AE or ES.`);
    const code = v.player_code ?? (id ? null : await nextPlayerCode(tx));
    const photo = (await uploadPlayerPhoto(fd.get("photo_file") as File | null, code ?? id ?? "player")) ?? v.photo_url;
    const fields = {
      full_name: v.full_name, country_code: country, nationality: v.nationality, photo_url: photo, playing_side: v.playing_side,
      division_id: v.division_id, status: v.status, base_rating: v.base_rating, base_points: v.base_points, base_tournaments: v.base_tournaments,
      base_matches: v.base_matches, base_wins: v.base_wins, base_losses: v.base_losses, updated_at: new Date(),
    };
    if (id) {
      const [before] = await tx`select * from players where id = ${id} for update`;
      if (!before) throw new Error("Player not found");
      const slug = before.full_name === v.full_name ? before.slug : await uniquePlayerSlug(tx, v.full_name, id);
      const [after] = await tx`update players set ${tx({ ...fields, slug, ...(code ? { player_code: code } : {}) })} where id = ${id} returning *`;
      if (before.division_id !== v.division_id) {
        await tx`insert into player_division_history (player_id, from_division_id, to_division_id, kind, reason, changed_by)
                 values (${id}, ${before.division_id}, ${v.division_id}, 'manual', ${v.division_reason ?? "Changed by admin"}, ${admin.id})`;
      }
      await tx`insert into player_private (player_id, email, phone, notes) values (${id}, ${v.email}, ${v.phone}, ${v.notes})
               on conflict (player_id) do update set email = excluded.email, phone = excluded.phone, notes = excluded.notes, updated_at = now()`;
      await audit(tx, admin, "player.update", "player", id, before, after);
      return `Saved ${v.full_name}`;
    }
    const slug = await uniquePlayerSlug(tx, v.full_name);
    const [row] = await tx`insert into players ${tx({ ...fields, slug, player_code: code! })} returning *`;
    await tx`insert into player_private (player_id, email, phone, notes) values (${row.id}, ${v.email}, ${v.phone}, ${v.notes})`;
    if (v.division_id) await tx`insert into player_division_history (player_id, to_division_id, kind, reason, changed_by) values (${row.id}, ${v.division_id}, 'initial', 'Created by admin', ${admin.id})`;
    await audit(tx, admin, "player.create", "player", row.id, undefined, row);
    createdId = row.id;
    return `Created ${v.full_name} (${row.player_code})`;
  }, { recalc: true, trigger: "player-save" });
  if (res?.ok && createdId) redirect(`/admin/players/${createdId}?created=1`);
  return res;
}

export async function deletePlayer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const res = await adminMutation(async ({ admin, tx }) => {
    const [{ n }] = await tx`select count(*)::int as n from match_players where player_id = ${id}`;
    if (n > 0) throw new Error(`This player has ${n} recorded matches. Set them to inactive instead so their results stay correct.`);
    const [before] = await tx`delete from players where id = ${id} returning *`;
    await audit(tx, admin, "player.delete", "player", id, before);
    return "Player deleted";
  }, { recalc: true, trigger: "player-delete" });
  if (res?.ok) redirect("/admin/players");
  return res;
}

const adjSchema = z.object({ player_id: z.string().uuid(), kind: z.enum(["delta", "set"]), value: z.coerce.number().finite(), reason: z.string().trim().min(3, "Give a reason"), effective_at: z.string().optional() });

export async function addRatingAdjustment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const v = adjSchema.parse(formObject(fd));
    const when = v.effective_at ? new Date(v.effective_at) : new Date();
    const [row] = await tx`insert into rating_adjustments (player_id, kind, value, reason, effective_at, created_by) values (${v.player_id}, ${v.kind}, ${v.value}, ${v.reason}, ${when}, ${admin.id}) returning *`;
    await audit(tx, admin, "rating.adjust", "player", v.player_id, undefined, row);
    return "Rating adjustment applied";
  }, { recalc: true, trigger: "rating-adjustment" });
}

export async function deleteRatingAdjustment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const [row] = await tx`delete from rating_adjustments where id = ${Number(fd.get("id"))} returning *`;
    await audit(tx, admin, "rating.adjust.delete", "player", row?.player_id ?? null, row);
    return "Adjustment removed";
  }, { recalc: true, trigger: "rating-adjustment" });
}
