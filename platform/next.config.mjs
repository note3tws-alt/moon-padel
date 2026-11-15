/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    // Public league pages are the same for every visitor (the header's account
    // button loads per person from /api/me in the browser), so Netlify's CDN
    // caches them: fresh for 60s, then served stale while it refreshes in the
    // background. Admin changes purge the tag at once (src/lib/cache.ts).
    // /account, /login and /admin stay private (src/middleware.ts).
    const cdn = [
      { key: "Netlify-CDN-Cache-Control", value: "public, durable, s-maxage=60, stale-while-revalidate=86400" },
      { key: "Netlify-Cache-Tag", value: "league-pages" },
    ];
    return ["/", "/leaderboard", "/players/:path*", "/pairs/:path*", "/tournaments/:path*", "/rules", "/privacy"].map(
      (source) => ({ source, headers: cdn }),
    );
  },
};
export default nextConfig;
