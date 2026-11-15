/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
export default nextConfig;
