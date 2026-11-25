import { PageHeader } from "@/components/admin/page-header";
import { EventForm } from "@/components/admin/events/event-form";
import { sql } from "@/lib/db";

export const metadata = { title: "New event" };

export default async function NewEvent() {
  const db = sql();
  const [clubs, tiers] = await Promise.all([
    db`select id, name from clubs where active order by name`,
    db`select id, code, numeric_order from skill_tiers where active and event_eligible order by numeric_order`,
  ]);
  return (
    <>
      <PageHeader title="New event" description="Create a Ladder Americano night. You add the 16 players next, then open check-in on the venue tablet." />
      <EventForm clubs={clubs as never} tiers={tiers as never} />
    </>
  );
}
