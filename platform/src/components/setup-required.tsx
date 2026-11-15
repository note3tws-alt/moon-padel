import { MoonMark } from "./brand";

export function SetupRequired() {
  return (
    <main className="container-page flex min-h-screen flex-col items-center justify-center py-20 text-center">
      <MoonMark size={96} glow phase="crescent" />
      <h1 className="h-display mt-8 text-3xl">Database not connected</h1>
      <p className="mt-3 max-w-lg text-muted">
        MoonPadel needs a Postgres database (Supabase recommended). Set <code className="text-ice">DATABASE_URL</code> and the Supabase keys,
        run the migrations, then reload. The steps are in <code className="text-ice">platform/README.md</code>.
      </p>
    </main>
  );
}
