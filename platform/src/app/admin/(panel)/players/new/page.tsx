import { PageHeader } from "@/components/admin/page-header";
import { PlayerForm } from "@/components/admin/player-form";
import { getDivisions } from "@/lib/queries";
import { supabaseStorageConfigured } from "@/lib/supabase/config";

export const metadata = { title: "New player" };
export default async function NewPlayer() {
  return (<><PageHeader title="New player" /><PlayerForm divisions={await getDivisions()} storage={supabaseStorageConfigured()} /></>);
}
