import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicLive } from "@/components/live/public-live";
import { findPublicEvent, getLiveState } from "@/lib/ladder/live";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live", description: "Live courts, scores and leaderboard from a MoonPadel night." };

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await findPublicEvent(slug);
  if (!id) notFound();
  const state = await getLiveState(id, "public");
  return <PublicLive initial={state} slug={slug} />;
}
