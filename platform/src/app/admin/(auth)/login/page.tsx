import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MoonMark, Wordmark } from "@/components/brand";
import { authMode, getAdmin } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { SetupRequired } from "@/components/setup-required";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isDatabaseConfigured()) return <SetupRequired />;
  if (await getAdmin()) redirect("/admin");
  const { next } = await searchParams;
  const mode = authMode();
  return (
    <main className="flex min-h-screen items-center justify-center bg-night-fade px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3"><MoonMark size={72} glow /><Wordmark className="text-3xl" /></Link>
        <div className="card p-6">
          <h1 className="text-lg font-bold">Admin sign in</h1>
          <p className="mb-5 mt-1 text-sm text-muted">Only MoonPadel administrators can access the dashboard.</p>
          {mode === "none" ? (
            <p className="text-sm text-[#f2a08c]">Sign-in is not configured. Add the Supabase URL and anon key (see platform/README.md).</p>
          ) : <LoginForm next={next} />}
          {mode === "local" && <p className="mt-4 text-[11px] text-muted">Local development login. In production, sign-in uses Supabase Auth.</p>}
        </div>
      </div>
    </main>
  );
}
