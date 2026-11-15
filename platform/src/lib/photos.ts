import "server-only";
import { supabaseStorageConfigured } from "./supabase/config";
import { supabaseService } from "./supabase/server";

/** Uploads a player photo to the public player-photos bucket and returns its URL, or null when no file was sent. */
export async function uploadPlayerPhoto(file: File | null, name: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!supabaseStorageConfigured()) throw new Error("Photo upload needs Supabase Storage. Paste an image URL instead, or add the Supabase keys.");
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Photo must be PNG, JPG or WebP.");
  if (file.size > 3 * 1024 * 1024) throw new Error("Photo must be under 3 MB.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${name.replace(/[^A-Za-z0-9/_-]/g, "")}-${Date.now()}.${ext}`;
  const sb = supabaseService();
  const { error } = await sb.storage.from("player-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return sb.storage.from("player-photos").getPublicUrl(path).data.publicUrl;
}
