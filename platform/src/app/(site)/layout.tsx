import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SetupRequired } from "@/components/setup-required";
import { isDatabaseConfigured } from "@/lib/db";
import { demoCounts, getSettings } from "@/lib/queries";

// Rendered on request (never during the build, where database calls stall on
// Netlify). Speed comes from Netlify's CDN cache, set in middleware.ts and
// cleared after admin changes by refreshPublicSite().
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  if (!isDatabaseConfigured()) return <SetupRequired />;
  const [{ general }, demo] = await Promise.all([getSettings(), demoCounts()]);
  const showDemo = general.showDemoBanner && (demo.players > 0 || demo.tournaments > 0);
  return (
    <div className="flex min-h-screen flex-col bg-night-fade">
      {showDemo && (
        <div className="border-b border-electric/30 bg-court/30 py-2 text-center text-xs font-semibold text-ice">
          Demo data: the players, venues and results shown are fictional and will be removed before launch.
        </div>
      )}
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter settings={general} />
    </div>
  );
}
