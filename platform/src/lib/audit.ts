import type { Tx } from "./db";
import type { AdminUser } from "./auth";

export async function audit(tx: Tx, actor: AdminUser | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) {
  await tx`insert into admin_audit_logs (actor_id, actor_email, action, entity, entity_id, before, after)
           values (${actor?.id ?? null}, ${actor?.email ?? null}, ${action}, ${entity}, ${entityId},
                   ${before === undefined ? null : tx.json(JSON.parse(JSON.stringify(before)))},
                   ${after === undefined ? null : tx.json(JSON.parse(JSON.stringify(after)))})`;
}
