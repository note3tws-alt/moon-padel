import Link from "next/link";

const UPDATED = "15 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="h-display mb-3 text-2xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-silver">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="container-page max-w-3xl py-12">
      <p className="label">Legal</p>
      <h1 className="h-display mt-3 text-4xl sm:text-5xl">Privacy policy</h1>
      <p className="mt-4 text-muted">
        This page explains what the MoonPadel league website collects, why we collect it, who can see it, and how you can ask us to change or remove it.
      </p>
      <p className="mt-2 text-xs text-muted">Last updated {UPDATED}</p>

      <Section title="Who we are">
        <p>
          MoonPadel is an independent padel tournament and league organiser in Dubai. This website shows league rankings, player profiles, tournaments and results, and lets players sign in to manage their own profile.
          You can reach us using the WhatsApp or email links at the bottom of every page.
        </p>
      </Section>

      <Section title="What is public">
        <p>
          When you play in a MoonPadel event, we publish league information so rankings can be checked by everyone: <strong>your name, player code, photo (if one was added), country flag, nationality, playing side, division, rating, ranking, match results and tournament finishes</strong>.
        </p>
        <p>If you would rather not have your photo or a detail shown, tell us and we will change it.</p>
      </Section>

      <Section title="What we keep private">
        <p>
          <strong>Sign-in details.</strong> If you sign in with Google, we receive your email address, your name and your Google profile picture. If you sign in with an email link, we receive your email address. We use these only to sign you in and to connect your sign-in to your player profile. Your email is never shown publicly.
        </p>
        <p>
          <strong>Phone number.</strong> You can add a phone number to your profile so organisers can contact you about events. Only MoonPadel administrators can see it.
        </p>
        <p>
          <strong>Profile requests.</strong> If you ask to be connected to a player profile, or to be added to the league, we keep your request and any message you write so an administrator can review it.
        </p>
        <p>
          <strong>Change history.</strong> When you edit your profile, we record what changed and when, so mistakes can be undone.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We only use cookies that are needed for signing in and keeping you signed in. We do not use advertising cookies, tracking pixels or analytics tools on this website.
        </p>
      </Section>

      <Section title="Services we use">
        <p>We use a small number of providers to run the website. They process data on our behalf:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong>: database, file storage for player photos, and sign-in.</li>
          <li><strong>Netlify</strong>: hosting of the website.</li>
          <li><strong>Google</strong>: only if you choose to sign in with Google.</li>
        </ul>
        <p>We do not sell your data and we do not share it with sponsors or advertisers.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          League results stay on the website as part of the official ranking history. Sign-in details and private profile details are kept while you have an account. If you ask us to remove your account, we disconnect it from your profile and delete your private details.
        </p>
      </Section>

      <Section title="Your choices">
        <p>You can:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>update your flag, nationality, playing side, photo and phone number yourself from <Link href="/account" className="text-ice hover:text-white">My profile</Link>;</li>
          <li>ask us for a copy of the private details we hold about you;</li>
          <li>ask us to correct a detail, hide your photo, or remove your account.</li>
        </ul>
        <p>Send your request using the WhatsApp or email links at the bottom of this page and we will reply as soon as we can.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>If we change how we use your data, we will update this page and the date at the top.</p>
      </Section>
    </main>
  );
}
