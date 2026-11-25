/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // inlineCss puts the (small, ~8 KB gzip) stylesheet into the HTML so the
  // first paint does not wait on a separate render-blocking CSS request.
  experimental: { serverActions: { bodySizeLimit: "10mb" }, inlineCss: true },
  async headers() {
    // Public league pages are the same for every visitor (the header's account
    // button loads per person from /api/me in the browser), so Netlify's CDN
    // caches them: fresh for 60s, then served stale while it refreshes in the
    // background. Admin changes purge the tag at once (src/lib/cache.ts).
    // /account, /login and /admin stay private (src/middleware.ts).
    const cdn = [
      { key: "Netlify-CDN-Cache-Control", value: "public, durable, s-maxage=60, stale-while-revalidate=86400" },
      { key: "Netlify-Cache-Tag", value: "league-pages" },
      // Same policy for Vercel's CDN (each host ignores the other's header).
      { key: "Vercel-CDN-Cache-Control", value: "s-maxage=60, stale-while-revalidate=86400" },
    ];
    // Kiosk, TV and live pages and their APIs are never cached: they must show the current event state.
    const live = [{ key: "Cache-Control", value: "private, no-store, max-age=0" }];
    // Security headers, set here so they apply on any host (netlify.toml sets them on Netlify too).
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      { source: "/:path*", headers: base },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/brand/mark/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      ...["/", "/leaderboard", "/players/:path*", "/pairs/:path*", "/tournaments/:path*", "/rules", "/privacy", "/nights", "/api/public/:path*"].map(
        (source) => ({ source, headers: cdn }),
      ),
      ...["/kiosk/:path*", "/tv/:path*", "/live/:path*", "/api/live/:path*", "/api/kiosk/:path*"].map((source) => ({ source, headers: live })),
    ];
  },
};
export default nextConfig;
