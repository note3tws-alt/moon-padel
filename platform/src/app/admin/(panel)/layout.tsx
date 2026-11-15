import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { SetupRequired } from "@/components/setup-required";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/admin/toast";
import { logout } from "../(auth)/login/actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | MoonPadel Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isDatabaseConfigured()) return <SetupRequired />;
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-space lg:flex">
      <AdminSidebar email={admin.email} signOut={logout} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      <Toaster />
    </div>
  );
}
