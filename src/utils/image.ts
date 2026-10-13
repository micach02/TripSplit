/** File-picker filter: any photo. Every upload is re-encoded as JPEG first. */
export const IMAGE_ACCEPT = 'image/*'

/**
 * Checks a picked file is a photo this browser can open, before it's used.
 * Phone formats such as iPhone HEIC work wherever the browser can decode them
 * (Safari); elsewhere people get a clear message rather than a failed upload.
 * Returns an error message, or null when the file is fine.
 */
export async function checkImageFile(file: File, maxBytes: number): Promise<string | null> {
  const looksLikeImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)
  if (!looksLikeImage) return 'Choose a photo (JPG, PNG, WEBP or HEIC).'
  if (file.size > maxBytes) {
    return `That photo is too large. Choose one under ${Math.round(maxBytes / (1024 * 1024))} MB.`
  }
  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
    return null
  } catch {
    return 'This browser can’t open that photo. Choose a JPG, PNG or WEBP photo instead.'
  }
}

/**
 * Downscales an image so its longest side is at most `maxSize` px and
 * re-encodes it as JPEG — phone photos shrink from megabytes to ~50 KB.
 */
export async function resizeImage(file: Blob, maxSize = 512, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not supported')

    // JPEG has no transparency — paint transparent PNG areas white, not black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}

/**
 * Receipt photos: big enough that small print stays legible, and always under
 * `maxBytes` (the storage bucket's limit) — falls back to a smaller, softer copy.
 */
export async function prepareReceiptImage(file: Blob, maxBytes: number): Promise<Blob> {
  const attempts: Array<[number, number]> = [
    [2000, 0.85],
    [1600, 0.75],
    [1200, 0.7],
  ]
  for (const [size, quality] of attempts) {
    const image = await resizeImage(file, size, quality)
    if (image.size <= maxBytes) return image
  }
  throw new Error('receipt_too_large')
}
