"use server";
import { z } from "zod";
import { adminMutation, formObject, type ActionState } from "@/lib/admin/action";
import { audit } from "@/lib/audit";

const tierSchema = z.object({
  code: z.string().trim().min(1).max(12),
  display_name: z.string().trim().min(1).max(40),
  numeric_order: z.coerce.number().int().min(1).max(99),
});

const ownerOnly = (role: string) => { if (role !== "admin") throw new Error("Only an owner/admin can change levels."); };

export async function saveTier(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    ownerOnly(admin.role);
    const id = fd.get("id") ? Number(fd.get("id")) : null;
    const v = tierSchema.parse(formObject(fd));
    const flags = { active: fd.get("active") === "on", event_eligible: fd.get("event_eligible") === "on" };
    if (id) {
      const [before] = await tx`select * from skill_tiers where id = ${id}`;
      const [after] = await tx`update skill_tiers set ${tx({ ...v, ...flags })} where id = ${id} returning *`;
      await audit(tx, admin, "skill_tier.update", "skill_tier", String(id), before, after);
      return `Saved ${v.code}`;
    }
    const [row] = await tx`insert into skill_tiers ${tx({ ...v, active: true, event_eligible: true })} returning *`;
    await audit(tx, admin, "skill_tier.create", "skill_tier", String(row.id), undefined, row);
    return `Added ${v.code}`;
  });
}

const medalSchema = z.object({
  name: z.string().trim().min(2).max(60),
  threshold: z.coerce.number().int().min(1).max(100000),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  image_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().nullable()),
});

export async function saveMedalTier(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    ownerOnly(admin.role);
    const id = fd.get("id") ? Number(fd.get("id")) : null;
    const v = medalSchema.parse(formObject(fd));
    const active = id ? fd.get("active") === "on" : true;
    if (id) {
      const [before] = await tx`select * from medal_tiers where id = ${id}`;
      const [after] = await tx`update medal_tiers set ${tx({ ...v, active })} where id = ${id} returning *`;
      await audit(tx, admin, "medal_tier.update", "medal_tier", String(id), before, after);
    } else {
      const [row] = await tx`insert into medal_tiers ${tx({ ...v, active })} returning *`;
      await audit(tx, admin, "medal_tier.create", "medal_tier", String(row.id), undefined, row);
    }
    // A new or lowered threshold unlocks for everyone who already has the points.
    const { syncMedals } = await import("@/lib/ladder/service");
    const ids = (await tx`select distinct player_id from player_points_ledger`).map((r) => r.player_id as string);
    const unlocked = await syncMedals(tx, ids, `admin:${admin.email}`, null, "Milestone settings changed");
    return `Saved ${v.name}${unlocked.length ? `. ${unlocked.length} player(s) unlocked it` : ""}`;
  });
}

export async function adjustPoints(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    ownerOnly(admin.role);
    const playerId = z.string().uuid().parse(fd.get("player_id"));
    const points = z.coerce.number().int().min(-10000).max(10000).refine((n) => n !== 0, "Enter a non-zero number").parse(fd.get("points"));
    const reason = z.string().trim().min(3, "Give a reason").parse(fd.get("reason"));
    await tx`insert into player_points_ledger (player_id, kind, points, reason, created_by) values (${playerId}, 'adjustment', ${points}, ${reason}, ${`admin:${admin.email}`})`;
    const { syncMedals } = await import("@/lib/ladder/service");
    await syncMedals(tx, [playerId], `admin:${admin.email}`, null, reason);
    await audit(tx, admin, "points.adjust", "player", playerId, undefined, { points, reason });
    return "Points adjusted";
  });
}
