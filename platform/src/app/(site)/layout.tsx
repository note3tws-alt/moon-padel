import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SetupRequired } from "@/components/setup-required";
import { isDatabaseConfigured } from "@/lib/db";
import { demoCounts, getSettings } from "@/lib/queries";

// Pages are cached and rebuilt at most every 5 minutes; admin changes refresh them at once.
export const revalidate = 300;

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
