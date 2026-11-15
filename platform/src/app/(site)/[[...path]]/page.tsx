import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomePage from "@/components/pages/home-page";
import RulesPage from "@/components/pages/rules-page";

/**
 * Serves "/" and "/rules". They live behind an optional catch-all so that
 * nothing here is prerendered during `next build` (prerendering against the
 * database has stalled Netlify builds). Each page is rendered on its first
 * visit and then cached like the rest of the public site (see the layout's
 * revalidate); admin changes refresh it through refreshPublicSite().
 * Other public routes (/leaderboard, /players, ...) are folders of their own
 * and take precedence over this catch-all.
 */
type Props = { params: Promise<{ path?: string[] }> };

export async function generateStaticParams() {
  return [];
}

function pageFor(path: string[] | undefined) {
  if (!path || path.length === 0) return "home";
  if (path.length === 1 && path[0] === "rules") return "rules";
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageFor((await params).path);
  if (page === "rules") return { title: "Rankings & Rules", description: "How MoonPadel ratings, points, divisions and monthly rankings work." };
  return {};
}

export default async function SitePage({ params }: Props) {
  const page = pageFor((await params).path);
  if (page === "home") return <HomePage />;
  if (page === "rules") return <RulesPage />;
  notFound();
}
