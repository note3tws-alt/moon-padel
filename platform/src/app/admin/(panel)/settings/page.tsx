import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { authMode, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { demoCounts, getSettings } from "@/lib/queries";
import { supabaseStorageConfigured } from "@/lib/supabase/config";
import { fmtDate } from "@/lib/utils";
import { addAdminUser, loadDemo, removeAdminUser, removeDemo, saveGeneralSettings, saveRulesSettings } from "../league-actions";

export const metadata = { title: "Website settings" };

export default async function SettingsAdmin() {
  const me = await requireAdmin();
  const [{ general: g, rules }, demo, admins] = await Promise.all([getSettings(), demoCounts(), sql()`select id, email, display_name, last_login_at from users order by email`]);
  const sections = [...rules.sections, ...Array.from({ length: Math.max(0, 6 - rules.sections.length) }, () => ({ title: "", body: "" }))];
  const mode = authMode();
  return (
    <>
      <PageHeader title="Website settings" />
      <ActionForm action={saveGeneralSettings} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="font-bold sm:col-span-2 lg:col-span-3">General</h2>
        <Field label="League name"><input name="leagueName" defaultValue={g.leagueName} className="input" /></Field>
        <Field label="Tagline"><input name="tagline" defaultValue={g.tagline} className="input" /></Field>
        <Field label="City"><input name="city" defaultValue={g.city} className="input" /></Field>
        <Field label="Hero headline"><input name="heroTitle" defaultValue={g.heroTitle} className="input" /></Field>
        <Field label="Hero supporting text" className="lg:col-span-2"><input name="heroSubtitle" defaultValue={g.heroSubtitle} className="input" /></Field>
        <Field label="WhatsApp number" hint="International format, digits only. Empty until confirmed."><input name="whatsappNumber" defaultValue={g.whatsappNumber} className="input" placeholder="9715XXXXXXXX" /></Field>
        <Field label="Instagram handle"><input name="instagramHandle" defaultValue={g.instagramHandle} className="input" placeholder="@moonpadel" /></Field>
        <Field label="Contact email"><input name="contactEmail" defaultValue={g.contactEmail} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showDemoBanner" defaultChecked={g.showDemoBanner} className="accent-electric" /> Show the demo data banner while demo data exists</label>
        <div className="flex justify-end sm:col-span-2 lg:col-span-3"><SubmitButton>Save settings</SubmitButton></div>
      </ActionForm>

      <ActionForm action={saveRulesSettings} className="card mt-6 space-y-4 p-5">
        <h2 className="font-bold">Rules page text</h2>
        <p className="text-xs text-muted">Scoring numbers on the rules page come from the active ruleset automatically. Use these sections for everything else. Empty sections are hidden.</p>
        <Field label="Introduction"><textarea name="intro" rows={3} defaultValue={rules.intro} className="input" /></Field>
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line p-3">
              <input name="section_title" defaultValue={s.title} placeholder={`Section ${i + 1} title`} className="input" />
              <textarea name="section_body" defaultValue={s.body} rows={3} placeholder="Text" className="input" />
            </div>
          ))}
        </div>
        <div className="flex justify-end"><SubmitButton>Save rules page</SubmitButton></div>
      </ActionForm>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Administrators</h2>
        <p className="mb-4 mt-1 text-xs text-muted">Sign-in: {mode === "supabase" ? "Supabase Auth" : mode === "local" ? "local development login" : "not configured"}. Photo storage: {supabaseStorageConfigured() ? "Supabase Storage" : "not configured (use image URLs)"}.</p>
        <ul className="mb-4 divide-y divide-line text-sm">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <span>{a.email}{a.id === me.id && <span className="ml-2 text-xs text-muted">(you)</span>} <span className="text-xs text-muted">· last sign-in {a.last_login_at ? fmtDate(a.last_login_at) : "never"}</span></span>
              {a.id !== me.id && <ActionForm action={removeAdminUser} confirm={`Remove ${a.email}?`}><input type="hidden" name="id" value={a.id} /><SubmitButton variant="ghost" className="btn-sm" pendingText="…">Remove</SubmitButton></ActionForm>}
            </li>
          ))}
        </ul>
        <ActionForm action={addAdminUser} resetOnSuccess className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Email"><input name="email" type="email" required className="input" /></Field>
          <Field label="Name"><input name="display_name" className="input" /></Field>
          {mode !== "supabase" && <Field label="Password"><input name="password" type="password" minLength={10} className="input" /></Field>}
          <SubmitButton variant="ghost">Add administrator</SubmitButton>
        </ActionForm>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Demo data</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          {demo.players || demo.tournaments
            ? `${demo.players} fictional players and ${demo.tournaments} fictional tournaments are loaded. Remove them before launch: real data you added stays untouched.`
            : "No demo data loaded. You can load fictional players, venues and results to explore the platform."}
        </p>
        {demo.players || demo.tournaments ? (
          <ActionForm action={removeDemo} confirm="Remove all demo players, pairs, venues and tournaments?"><SubmitButton variant="danger" pendingText="Removing…">Remove demo data</SubmitButton></ActionForm>
        ) : (
          <ActionForm action={loadDemo}><SubmitButton variant="ghost" pendingText="Loading…">Load demo data</SubmitButton></ActionForm>
        )}
      </section>
    </>
  );
}
