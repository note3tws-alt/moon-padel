import type { MetadataRoute } from "next";

/** Lets admins, the venue tablet and the TV install MoonPadel as an app from the browser. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoonPadel",
    short_name: "MoonPadel",
    description: "MoonPadel Ladder Americano nights: check-in, live scores, leaderboards and medals.",
    start_url: "/",
    display: "standalone",
    background_color: "#04070F",
    theme_color: "#04070F",
    icons: [
      { src: "/brand/mark-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/mark-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
