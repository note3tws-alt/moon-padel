import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// Variable font: one file covers every weight, instead of one file per weight.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "MoonPadel | Padel league rankings and tournaments", template: "%s | MoonPadel" },
  description: "Live padel leaderboards, player profiles, tournaments and results from the MoonPadel league in Dubai.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  openGraph: { type: "website", siteName: "MoonPadel", images: ["/brand/logo-stacked.png"] },
};

export const viewport: Viewport = { themeColor: "#04070F" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
