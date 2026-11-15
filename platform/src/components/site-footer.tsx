import Link from "next/link";
import { MoonMark, Wordmark } from "./brand";
import type { GeneralSettings } from "@/lib/queries";

export function SiteFooter({ settings }: { settings: GeneralSettings }) {
  const wa = settings.whatsappNumber.replace(/\D/g, "");
  return (
    <footer className="mt-24 border-t border-line bg-night/40">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3"><MoonMark size={44} /><Wordmark className="text-2xl" /></div>
          <p className="mt-3 text-xs font-medium uppercase tracking-brand text-ice/80">{settings.tagline.replace(/\.$/, "")}</p>
          <p className="mt-4 max-w-sm text-sm text-muted">Competitive padel tournaments and league rankings in {settings.city}. MoonPadel organises events at partner venues.</p>
        </div>
        <div>
          <p className="label mb-3">League</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link className="hover:text-silver" href="/leaderboard">Leaderboard</Link></li>
            <li><Link className="hover:text-silver" href="/tournaments">Tournaments</Link></li>
            <li><Link className="hover:text-silver" href="/players">Players</Link></li>
            <li><Link className="hover:text-silver" href="/rules">Rankings & Rules</Link></li>
          </ul>
        </div>
        <div>
          <p className="label mb-3">Join</p>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <a className="hover:text-silver" href={`https://wa.me/${wa}?text=MOON`} target="_blank" rel="noreferrer">WhatsApp &quot;MOON&quot;</a>
            </li>
            {settings.instagramHandle && <li><a className="hover:text-silver" href={`https://instagram.com/${settings.instagramHandle.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Instagram</a></li>}
            {settings.contactEmail && <li><a className="hover:text-silver" href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li>}
            <li><Link className="hover:text-silver" href="/admin">Admin login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">© {new Date().getFullYear()} {settings.leagueName}. All rankings come from verified results.</div>
    </footer>
  );
}
