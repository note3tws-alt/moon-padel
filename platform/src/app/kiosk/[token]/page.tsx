import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KioskScreen } from "@/components/live/kiosk";
import { loadScreen } from "@/lib/ladder/screen-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Check-in tablet", robots: { index: false, follow: false } };

export default async function KioskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await loadScreen(token, "kiosk");
  if (!state) notFound();
  return <KioskScreen initial={state} token={token} topic={`mp-${token}`} />;
}
