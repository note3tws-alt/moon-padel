import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { EventForm } from "@/components/admin/events/event-form";
import { sql } from "@/lib/db";

export const metadata = { title: "Edit event" };

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = sql();
  const [event] = await db`select e.*, (select count(*)::int from ladder_matches m where m.event_id = e.id) as match_count from ladder_events e where e.id = ${id}`;
  if (!event) notFound();
  const [clubs, tiers] = await Promise.all([
    db`select id, name from clubs where active order by name`,
    db`select id, code, numeric_order from skill_tiers where active and event_eligible order by numeric_order`,
  ]);
  return (
    <>
      <PageHeader title={`Edit: ${event.title}`} />
      <EventForm event={event} clubs={clubs as never} tiers={tiers as never} locked={event.match_count > 0} />
    </>
  );
}
