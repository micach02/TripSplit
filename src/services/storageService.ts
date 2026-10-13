import { supabase } from '@/lib/supabase'

// Prefixed so it can't collide with another app sharing the Supabase project.
const AVATAR_BUCKET = 'tripsplit-avatars'

/** Matches the bucket's limits in supabase/migrations/*_storage_avatars.sql. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
// The buckets accept JPEG/PNG/WEBP only; pickers take any photo the browser can
// open and re-encode it as JPEG first (utils/image.ts).

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Uploads an avatar to avatars/<user id>/… and returns its public URL. */
export async function uploadAvatar(userId: string, image: Blob): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.${EXTENSIONS[image.type] ?? 'jpg'}`
  const bucket = supabase.storage.from(AVATAR_BUCKET)

  const { error } = await bucket.upload(path, image, {
    contentType: image.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error

  return bucket.getPublicUrl(path).data.publicUrl
}

/** Storage path for one of our avatar URLs, or null for anything else. */
export function avatarPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0])
}

// ---------------------------------------------------------------------------
// Trip covers — private bucket; members read through short-lived signed URLs.
// ---------------------------------------------------------------------------
const COVER_BUCKET = 'tripsplit-trip-covers'
const COVER_URL_TTL_SECONDS = 60 * 60

/** Uploads a cover to tripsplit-trip-covers/<trip id>/… and returns its storage path. */
export async function uploadTripCover(tripId: string, image: Blob): Promise<string> {
  const path = `${tripId}/cover-${Date.now()}.${EXTENSIONS[image.type] ?? 'jpg'}`
  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, image, {
    contentType: image.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeTripCover(path: string | null | undefined): Promise<void> {
  if (!path) return
  await supabase.storage.from(COVER_BUCKET).remove([path])
}

/** Signed URLs for the given cover paths (missing or failed paths are left out). */
export async function getCoverUrls(paths: ReadonlyArray<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))]
  const urls = new Map<string, string>()
  if (unique.length === 0) return urls

  const { data, error } = await supabase.storage.from(COVER_BUCKET).createSignedUrls(unique, COVER_URL_TTL_SECONDS)
  if (error) return urls // covers are decorative; never fail a page over them
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return urls
}

// ---------------------------------------------------------------------------
// Receipts — private bucket: tripsplit-receipts/<trip id>/<expense id>/<file>.
// Members view through signed URLs; only expense editors can write.
// ---------------------------------------------------------------------------
const RECEIPT_BUCKET = 'tripsplit-receipts'
const RECEIPT_URL_TTL_SECONDS = 60 * 60

/** Matches the bucket limit in supabase/migrations/*_receipts.sql. */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

export async function uploadReceipt(tripId: string, expenseId: string, image: Blob): Promise<string> {
  const path = `${tripId}/${expenseId}/receipt-${Date.now()}.${EXTENSIONS[image.type] ?? 'jpg'}`
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, image, {
    contentType: image.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeReceipt(path: string | null | undefined): Promise<void> {
  if (!path) return
  await supabase.storage.from(RECEIPT_BUCKET).remove([path])
}

export async function getReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, RECEIPT_URL_TTL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

/** Best effort: removes every receipt file of a trip (before the trip is deleted). */
export async function removeTripReceipts(tripId: string): Promise<void> {
  const bucket = supabase.storage.from(RECEIPT_BUCKET)
  const { data: folders } = await bucket.list(tripId, { limit: 1000 })
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${tripId}/${folder.name}`, { limit: 100 })
    const paths = (files ?? []).map((file) => `${tripId}/${folder.name}/${file.name}`)
    if (paths.length > 0) await bucket.remove(paths)
  }
}

/** Best-effort cleanup of a replaced avatar; failures are ignored. */
export async function removeAvatar(url: string | null | undefined): Promise<void> {
  const path = url ? avatarPathFromUrl(url) : null
  if (!path) return
  await supabase.storage.from(AVATAR_BUCKET).remove([path])
}
