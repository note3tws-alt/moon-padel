import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TvScreen } from "@/components/live/tv";
import { loadScreen } from "@/lib/ladder/screen-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live TV", robots: { index: false, follow: false } };

export default async function TvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await loadScreen(token, "tv");
  if (!state) notFound();
  return <TvScreen initial={state} endpoint={`/api/live/${token}`} topic={`mp-${token}`} />;
}
