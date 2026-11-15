import { revalidatePath, revalidateTag } from "next/cache";

/** Tag on cached public-site data. */
export const LEAGUE_TAG = "league";

/** Netlify CDN cache tag on public pages (set in middleware.ts). */
export const CDN_TAG = "league-pages";

/** Call after any admin change: clears cached public pages and cached league data. */
export async function refreshPublicSite() {
  revalidateTag(LEAGUE_TAG);
  revalidatePath("/", "layout");
  // Best effort: only works when running on Netlify. Without it pages refresh within a minute anyway.
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost")) {
    try {
      const { purgeCache } = await import("@netlify/functions");
      await purgeCache({ tags: [CDN_TAG] });
    } catch (err) {
      console.warn("[cache] CDN purge failed:", (err as Error).message);
    }
  }
}
