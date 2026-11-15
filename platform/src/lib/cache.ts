import { revalidatePath, revalidateTag } from "next/cache";

/** Tag on cached public-site data. */
export const LEAGUE_TAG = "league";

/** Call after any admin change: clears cached public pages and cached league data. */
export function refreshPublicSite() {
  revalidateTag(LEAGUE_TAG);
  revalidatePath("/", "layout");
}
