"use server";
import { z } from "zod";
import { adminMutation, formObject, type ActionState } from "@/lib/admin/action";
import { audit } from "@/lib/audit";

const approveSchema = z.object({ claim_id: z.string().uuid(), player_id: z.string().uuid({ message: "Pick the player profile to connect" }) });

export async function approveClaim(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const v = approveSchema.parse(formObject(fd));
    const [claim] = await tx`select * from player_claims where id = ${v.claim_id} for update`;
    if (!claim || claim.status !== "pending") throw new Error("This request was already handled.");
    const [player] = await tx`select id, full_name, status from players where id = ${v.player_id} for update`;
    if (!player) throw new Error("Player not found.");
    const [takenPlayer] = await tx`select auth_user_id, email from player_accounts where player_id = ${v.player_id}`;
    if (takenPlayer) throw new Error(`${player.full_name} is already connected to ${takenPlayer.email ?? "another account"}. Disconnect it first.`);
    const [takenUser] = await tx`select player_id from player_accounts where auth_user_id = ${claim.auth_user_id}`;
    if (takenUser) throw new Error("This sign-in is already connected to a player.");
    const [row] = await tx`insert into player_accounts (auth_user_id, player_id, email, linked_via, linked_by)
                           values (${claim.auth_user_id}, ${v.player_id}, ${claim.email}, 'admin_approved', ${admin.id}) returning *`;
    await tx`update player_claims set status = 'approved', player_id = ${v.player_id}, decided_by = ${admin.id}, decided_at = now() where id = ${v.claim_id}`;
    await audit(tx, admin, "account.link", "player", v.player_id, undefined, row);
    return `Connected ${player.full_name} to ${claim.email ?? "the account"}`;
  });
}

const rejectSchema = z.object({ claim_id: z.string().uuid(), note: z.string().trim().max(300).optional() });

export async function rejectClaim(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const v = rejectSchema.parse(formObject(fd));
    const [claim] = await tx`update player_claims set status = 'rejected', decided_by = ${admin.id}, decided_at = now(), decision_note = ${v.note || null}
                             where id = ${v.claim_id} and status = 'pending' returning *`;
    if (!claim) throw new Error("This request was already handled.");
    await audit(tx, admin, "account.claim.reject", "player_claim", v.claim_id, undefined, claim);
    return "Request declined";
  });
}

export async function unlinkAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const userId = z.string().uuid().parse(fd.get("auth_user_id"));
    const [row] = await tx`delete from player_accounts where auth_user_id = ${userId} returning *`;
    if (!row) throw new Error("Already disconnected.");
    await audit(tx, admin, "account.unlink", "player", row.player_id, row);
    return "Account disconnected. The player profile and results are unchanged.";
  });
}
