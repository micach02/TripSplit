import { describe, expect, it } from 'vitest'
import { checkImageFile } from '@/utils/image'

const MB = 1024 * 1024

describe('checkImageFile', () => {
  it('turns away files that are not photos', async () => {
    const pdf = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' })
    expect(await checkImageFile(pdf, 20 * MB)).toBe('Choose a photo (JPG, PNG, WEBP or HEIC).')
  })

  it('turns away photos over the size limit', async () => {
    const big = new File([new Uint8Array(3 * MB)], 'big.jpg', { type: 'image/jpeg' })
    expect(await checkImageFile(big, 2 * MB)).toBe('That photo is too large. Choose one under 2 MB.')
  })

  it('treats .heic files with no type as photos, then needs the browser to open them', async () => {
    // Node can't decode images, standing in for a browser without HEIC support.
    const heic = new File(['not really heic'], 'IMG_0001.HEIC', { type: '' })
    expect(await checkImageFile(heic, 20 * MB)).toBe(
      'This browser can’t open that photo. Choose a JPG, PNG or WEBP photo instead.',
    )
  })
})
