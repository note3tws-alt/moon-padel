import { PageHeader } from "@/components/admin/page-header";
import { TournamentForm } from "@/components/admin/tournament-form";
import { sql } from "@/lib/db";
import { getDivisions } from "@/lib/queries";

export const metadata = { title: "New tournament" };
export default async function NewTournament() {
  const [divisions, clubs] = await Promise.all([getDivisions(), sql()`select id, name from clubs where active order by name`]);
  return (<><PageHeader title="New tournament" /><TournamentForm divisions={divisions} clubs={clubs as unknown as { id: string; name: string }[]} /></>);
}
