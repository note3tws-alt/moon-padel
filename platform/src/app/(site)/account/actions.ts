"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { refreshPublicSite } from "@/lib/cache";
import { toCountryCode } from "@/lib/countries";
import { uploadPlayerPhoto } from "@/lib/photos";
import { getLinkedPlayer, getPlayerUser } from "@/lib/player-auth";

export type FormState = { ok?: boolean; message?: string; error?: string } | null;

async function requirePlayerUser() {
  const user = await getPlayerUser();
  if (!user) throw new Error("Your session has ended. Please sign in again.");
  return user;
}

function fail(e: unknown): FormState {
  const err = e as { code?: string; message?: string };
  if (err?.code === "23505") return { error: "You already have a request waiting. Cancel it first to send a new one." };
  if (err?.message && !err.code) return { error: err.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

const claimSchema = z.object({
  player_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  requested_name: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
});

/** Ask an admin to connect this sign-in to a player profile (or to create one). */
export async function submitClaim(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePlayerUser();
    const v = claimSchema.parse(Object.fromEntries(fd));
    const requestedName = v.requested_name || null;
    if (!v.player_id && (!requestedName || requestedName.length < 2)) return { error: "Pick your profile, or type your full name." };
    await sql().begin(async (tx) => {
      if (await getLinkedPlayer(user.id, tx)) throw new Error("Your account is already connected to a player profile.");
      if (v.player_id) {
        const [p] = await tx`select id, status, exists (select 1 from player_accounts a where a.player_id = players.id) as taken from players where id = ${v.player_id}`;
        if (!p || p.status !== "active") throw new Error("That player profile could not be found.");
        if (p.taken) throw new Error("That profile is already connected to an account. If it is yours, message MoonPadel on WhatsApp.");
      }
      await tx`update player_claims set status = 'cancelled', decided_at = now() where auth_user_id = ${user.id} and status = 'pending'`;
      await tx`insert into player_claims (auth_user_id, email, player_id, requested_name, message)
               values (${user.id}, ${user.email}, ${v.player_id ?? null}, ${v.player_id ? null : requestedName}, ${v.message || null})`;
    });
    revalidatePath("/account");
    return { ok: true, message: "Request sent. An admin will check it and connect your profile." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelClaim(): Promise<void> {
  const user = await getPlayerUser();
  if (!user) return;
  await sql()`update player_claims set status = 'cancelled', decided_at = now() where auth_user_id = ${user.id} and status = 'pending'`;
  revalidatePath("/account");
}

const profileSchema = z.object({
  country: z.string().trim().max(60).optional(),
  nationality: z.string().trim().max(60).optional(),
  playing_side: z.enum(["", "left", "right", "both"]).transform((v) => v || null),
  phone: z.string().trim().max(30).refine((v) => v === "" || /^[+0-9 ()-]{6,30}$/.test(v), "Phone can only use digits, spaces and +").optional(),
  remove_photo: z.string().optional(),
});

/** Players can change only their own non-scoring details. Name, division and stats stay admin-only. */
export async function updateMyProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePlayerUser();
    const player = await getLinkedPlayer(user.id);
    if (!player) return { error: "Your account is not connected to a player profile yet." };
    const parsed = profileSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
    const v = parsed.data;
    const country = v.country ? toCountryCode(v.country) : null;
    if (v.country && !country) return { error: "Pick a country from the list." };

    let photo = player.photo_url;
    const file = fd.get("photo_file");
    const uploaded = await uploadPlayerPhoto(file instanceof File ? file : null, `self/${player.player_code}`);
    if (uploaded) photo = uploaded;
    else if (v.remove_photo === "on") photo = null;

    await sql().begin(async (tx) => {
      const [before] = await tx`select country_code, nationality, playing_side, photo_url from players where id = ${player.id} for update`;
      const [after] = await tx`
        update players set country_code = ${country}, nationality = ${v.nationality || null}, playing_side = ${v.playing_side},
               photo_url = ${photo}, updated_at = now()
        where id = ${player.id} returning country_code, nationality, playing_side, photo_url`;
      if (v.phone !== undefined) {
        await tx`insert into player_private (player_id, phone) values (${player.id}, ${v.phone || null})
                 on conflict (player_id) do update set phone = excluded.phone, updated_at = now()`;
      }
      await tx`insert into admin_audit_logs (actor_id, actor_email, action, entity, entity_id, before, after)
               values (null, ${user.email}, 'player.self_update', 'player', ${player.id}, ${tx.json(JSON.parse(JSON.stringify(before)))}, ${tx.json(JSON.parse(JSON.stringify(after)))})`;
      await tx`update player_accounts set last_seen_at = now() where auth_user_id = ${user.id}`;
    });
    refreshPublicSite();
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return fail(e);
  }
}
