import { PageHeader } from "@/components/admin/page-header";
import { PlayerForm } from "@/components/admin/player-form";
import { getDivisions } from "@/lib/queries";
import { supabaseStorageConfigured } from "@/lib/supabase/config";
import { sql } from "@/lib/db";

export const metadata = { title: "New player" };
export default async function NewPlayer() {
  return (<><PageHeader title="New player" /><PlayerForm divisions={await getDivisions()} storage={supabaseStorageConfigured()} tiers={(await sql()`select id, code from skill_tiers where active order by numeric_order`) as never} /></>);
}
